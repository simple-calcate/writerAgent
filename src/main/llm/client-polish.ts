import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, PolishResult, AutoPolishResult, DiffItem, BookAIConfig, AIFeatureAdvancedConfig } from '../../shared/types'
import { streamWithThinking } from './streaming'
import { fixMojibake } from './streaming'
import { getFeatureSkillContent } from './feature-skills'
import { createClient, isLocalProvider } from './client'
import { log } from '../utils/logger'

/** 将底层 LLM/网络错误包装为用户可读的中文提示 */
function friendlyLLMError(action: string, err: unknown): Error {
  const e = err as { name?: string; status?: number; message?: string }
  if (e?.name === 'AbortError') {
    return new Error(`${action}已取消`)
  }
  if (e?.status === 401 || e?.status === 403) {
    return new Error(`${action}失败：API Key 无效或权限不足（${e.status}）`)
  }
  if (e?.status === 429) {
    return new Error(`${action}失败：请求过于频繁，请稍后重试（429 限流）`)
  }
  if (e?.status && e.status >= 500) {
    return new Error(`${action}失败：模型服务暂时不可用（${e.status}）`)
  }
  const msg = e?.message || String(err)
  return new Error(`${action}失败：${msg}`)
}

// Single-segment polish with context
export async function polishText(
  config: LLMConfigSingle,
  original: string,
  context: string,
  mainWindow?: BrowserWindow,
  signal?: AbortSignal,
  advancedConfig?: AIFeatureAdvancedConfig
): Promise<PolishResult> {
  const client = createClient(config)

  const skillContent = advancedConfig?.systemPrompt || getFeatureSkillContent('polish')
  const systemPrompt = skillContent
    ? `${skillContent}\n\n返回严格 JSON：{"polished":"润色后文字","reason":"改动理由"}`
    : `你是一位网文写作助手，专注于文风润色。你的任务是：
- 保持原文意思完全不变
- 改善用词精准度、句式节奏、描写生动度
- 不要添加原文没有的情节、人物或信息
- 不要删减原文的核心内容
- 用一句话简要说明你做了什么改动（reason字段）
- 返回严格 JSON：{"polished":"润色后文字","reason":"改动理由"}`

  const temperature = advancedConfig?.temperature ?? 0.7

  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt
    },
    {
      role: 'user' as const,
      content: `上下文（前后文，供参考风格一致性）：\n${context}\n\n请润色以下文字：\n${original}`
    }
  ]

  const isOllama = isLocalProvider(config)
  const jsonFormat = isOllama ? {} : { response_format: { type: 'json_object' as const } }

  let content: string
  try {
    if (mainWindow) {
      content = await streamWithThinking(mainWindow, client, config, {
        model: config.model || 'gpt-4o-mini',
        messages,
        temperature,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
        ...jsonFormat
      }, signal)
    } else {
      const response = await client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages,
        temperature,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
        ...jsonFormat
      })
      content = fixMojibake(response.choices[0]?.message?.content?.trim() || '{}')
    }
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err
    throw friendlyLLMError('润色', err)
  }
  let polished = original
  let reason = '未提供理由'

  try {
    const parsed = JSON.parse(content)
    polished = parsed.polished || original
    reason = parsed.reason || '未提供理由'
  } catch {
    // Fallback: treat entire response as polished text
    polished = content || original
  }

  return {
    id: randomUUID(),
    original,
    polished,
    reason,
    position: 0,
    diffs: computeDiff(original, polished),
    accepted: false
  }
}

// Auto-detect weak paragraphs and polish them (single LLM call, index-based positioning)
export async function autoPolish(
  config: LLMConfigSingle,
  content: string,
  aiConfig?: Partial<BookAIConfig>,
  mainWindow?: BrowserWindow,
  signal?: AbortSignal
): Promise<AutoPolishResult> {
  const client = createClient(config)

  // Split into paragraphs and number them
  const paragraphs = content.split('\n\n')
  const numbered = paragraphs.map((p, i) => `[${i}] ${p}`).join('\n')

  const advancedConfig = aiConfig?.polishAdvanced
  const skillPrompt = advancedConfig?.systemPrompt || getFeatureSkillContent('polish')
  const basePrompt = skillPrompt || `你是一位网文编辑，擅长发现并润色文字中需要改进的地方。

以下是一个网文章节，已按段落编号。请分析每个段落，找出需要润色的段落并直接给出润色后的版本。

要求：
- 只选择确实需要改进的段落，不要改动已经好的部分
- 最多选择5个最需要改进的段落
- 润色时保持原文意思完全不变，只改善用词、句式、描写
- 返回严格 JSON

输出格式：
{"results":[{"index":段落编号,"polished":"润色后的完整段落","reason":"改动理由"}]}`

  const messages = [
    {
      role: 'system' as const,
      content: `${basePrompt}
${aiConfig?.polishStandard ? '\n润色标准：' + aiConfig.polishStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
    },
    { role: 'user' as const, content: numbered }
  ]

  const temperature = advancedConfig?.temperature ?? 0.7
  const isOllama = isLocalProvider(config)
  const jsonFormat = isOllama ? {} : { response_format: { type: 'json_object' as const } }

  let rawContent: string | undefined
  try {
    if (mainWindow) {
      rawContent = await streamWithThinking(mainWindow, client, config, {
        model: config.model || 'gpt-4o-mini',
        messages,
        temperature,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
        ...jsonFormat
      }, signal)
    } else {
      const response = await client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages,
        temperature,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
        ...jsonFormat
      })
      rawContent = fixMojibake(response.choices[0]?.message?.content ?? '')
    }
  } catch (err) {
    if ((err as any)?.name === 'AbortError') throw err
    throw friendlyLLMError('自动润色', err)
  }

  log.debug('[polish] raw response:', rawContent?.substring(0, 500))

  const parseContent = rawContent?.trim() || '{"results":[]}'
  let results: { index: number; polished: string; reason: string }[] = []

  const extractResults = (parsed: any): { index: number; polished: string; reason: string }[] => {
    if (Array.isArray(parsed)) return parsed
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results
    if (parsed.polished) return [parsed]
    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key])) return parsed[key]
    }
    return []
  }

  const normalizeItem = (item: any, i: number): { index: number; polished: string; reason: string } | null => {
    if (!item || typeof item !== 'object' || !item.polished) return null
    const idx = typeof item.index === 'number' ? item.index : typeof item.value === 'number' ? item.value : i
    return { index: idx, polished: item.polished, reason: item.reason || '' }
  }

  const tryParse = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text)
      const raw = extractResults(parsed)
      results = raw.map((item, i) => normalizeItem(item, i)).filter(Boolean) as typeof results
      return results.length > 0
    } catch { return false }
  }

  if (!tryParse(parseContent)) {
    const codeBlockMatch = parseContent.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch && tryParse(codeBlockMatch[1].trim())) {
      // parsed from code block
    } else if (tryParse('{"results":' + parseContent + '}')) {
      // bare array or object without wrapper
    } else {
      const arrayMatch = parseContent.match(/\[[\s\S]*\]/)
      if (arrayMatch && tryParse(arrayMatch[0])) {
        // extracted array from malformed JSON
      } else {
        log.debug('[polish] all parse attempts failed, raw:', parseContent.substring(0, 200))
      }
    }
  }

  // Build PolishResult[] with index-based position calculation
  const suggestions: PolishResult[] = results
    .filter(r => r.index >= 0 && r.index < paragraphs.length && r.polished)
    .map(r => {
      let position = 0
      for (let i = 0; i < r.index; i++) {
        position += paragraphs[i].length + 2 // +2 for \n\n
      }
      const original = paragraphs[r.index]
      return {
        id: randomUUID(),
        original,
        polished: r.polished,
        reason: r.reason || '未提供理由',
        position,
        diffs: computeDiff(original, r.polished),
        accepted: false
      }
    })

  log.debug('[polish] suggestions:', suggestions.length)
  return { suggestions }
}

function computeDiff(original: string, polished: string): DiffItem[] {
  const origWords = original.split(/(\s+)/)
  const polishWords = polished.split(/(\s+)/)
  const diffs: DiffItem[] = []

  const m = origWords.length
  const n = polishWords.length

  if (m > 500 || n > 500) {
    if (original === polished) return [{ type: 'unchanged', value: original }]
    return [
      { type: 'removed', value: original },
      { type: 'added', value: polished }
    ]
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1] === polishWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m, j = n
  const rawDiffs: DiffItem[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === polishWords[j - 1]) {
      rawDiffs.unshift({ type: 'unchanged', value: origWords[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawDiffs.unshift({ type: 'added', value: polishWords[j - 1] })
      j--
    } else {
      rawDiffs.unshift({ type: 'removed', value: origWords[i - 1] })
      i--
    }
  }

  for (const d of rawDiffs) {
    if (diffs.length > 0 && diffs[diffs.length - 1].type === d.type) {
      diffs[diffs.length - 1].value += d.value
    } else {
      diffs.push({ ...d })
    }
  }

  return diffs
}
