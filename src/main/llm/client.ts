import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, PolishResult, AutoPolishResult, DiffItem, BookAIConfig, ThinkingDepth, APIProvider } from '../../shared/types'
import { streamWithThinking } from './streaming'
import { getFeatureSkillContent } from './feature-skills'

export function createClient(config: LLMConfigSingle): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || 'https://api.openai.com/v1'
  })
}

// 思考深度预设 → token 预算映射
const THINKING_BUDGET_PRESETS: Record<string, number> = {
  low: 2048,
  medium: 8192,
  high: 32768
}

// 检测 API 提供商（URL 优先，模型名兜底）
export function detectProvider(config: LLMConfigSingle): APIProvider {
  const baseUrl = (config.baseUrl || '').toLowerCase()
  const model = (config.model || '').toLowerCase()

  if (baseUrl.includes('deepseek')) return 'deepseek'
  if (baseUrl.includes('anthropic') || baseUrl.includes('claude')) return 'claude'
  if (baseUrl.includes('moonshot') || baseUrl.includes('kimi')) return 'moonshot'
  if (baseUrl.includes('qwen') || baseUrl.includes('dashscope') || baseUrl.includes('tongyi')) return 'qwen'
  if (baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434')) return 'ollama'
  if (baseUrl.includes('openrouter.ai')) return 'openrouter'
  if (baseUrl.includes('openai.com')) return 'openai'

  if (model.startsWith('deepseek')) return 'deepseek'
  if (model.startsWith('o1') || model.startsWith('o3')) return 'openai'
  if (model.startsWith('claude')) return 'claude'
  if (model.startsWith('qwen')) return 'qwen'

  return 'generic'
}

// 根据思考深度设置和 API 提供商构建请求参数
export function buildThinkingParams(config: LLMConfigSingle): Record<string, any> {
  const td = config.thinkingDepth
  if (!td || td.preset === 'off') return {}

  const provider = detectProvider(config)
  const budget = td.preset === 'custom'
    ? (td.budgetTokens || 8192)
    : (THINKING_BUDGET_PRESETS[td.preset] || 8192)

  switch (provider) {
    case 'deepseek':
    case 'qwen':
      return { enable_thinking: true, max_tokens: budget }
    case 'openai':
      return {
        reasoning_effort: td.preset === 'custom'
          ? (budget <= 2048 ? 'low' : budget <= 8192 ? 'medium' : 'high')
          : td.preset
      }
    case 'claude':
      return { thinking: { type: 'enabled', budget_tokens: budget } }
    default:
      return {}
  }
}

export function hasThinkingParams(config: LLMConfigSingle): boolean {
  const td = config.thinkingDepth
  return !!td && td.preset !== 'off' && Object.keys(buildThinkingParams(config)).length > 0
}

// Single-segment polish with context
export async function polishText(
  config: LLMConfigSingle,
  original: string,
  context: string,
  mainWindow?: BrowserWindow,
  signal?: AbortSignal
): Promise<PolishResult> {
  const client = createClient(config)

  const skillContent = getFeatureSkillContent('polish')
  const systemPrompt = skillContent
    ? `${skillContent}\n\n返回严格 JSON：{"polished":"润色后文字","reason":"改动理由"}`
    : `你是一位网文写作助手，专注于文风润色。你的任务是：
- 保持原文意思完全不变
- 改善用词精准度、句式节奏、描写生动度
- 不要添加原文没有的情节、人物或信息
- 不要删减原文的核心内容
- 用一句话简要说明你做了什么改动（reason字段）
- 返回严格 JSON：{"polished":"润色后文字","reason":"改动理由"}`

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

  let content: string
  if (mainWindow) {
    content = await streamWithThinking(mainWindow, client, config, {
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      response_format: { type: 'json_object' }
    }, signal)
  } else {
    const response = await client.chat.completions.create({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      response_format: { type: 'json_object' }
    })
    content = response.choices[0]?.message?.content?.trim() || '{}'
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

  const skillPrompt = getFeatureSkillContent('polish')
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

  let rawContent: string | undefined
  if (mainWindow) {
    rawContent = await streamWithThinking(mainWindow, client, config, {
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      response_format: { type: 'json_object' }
    }, signal)
  } else {
    const response = await client.chat.completions.create({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      response_format: { type: 'json_object' }
    })
    rawContent = response.choices[0]?.message?.content ?? undefined
  }

  console.log('[polish] raw response:', rawContent?.substring(0, 500))

  const parseContent = rawContent?.trim() || '{"results":[]}'
  let results: { index: number; polished: string; reason: string }[] = []

  try {
    const parsed = JSON.parse(parseContent)
    results = parsed.results || []
  } catch (e) {
    // Try extracting JSON from markdown code block
    const jsonMatch = parseContent.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim())
        results = parsed.results || []
      } catch {
        console.log('[polish] failed to parse code block JSON')
        return { suggestions: [] }
      }
    } else {
      console.log('[polish] JSON parse failed:', e)
      return { suggestions: [] }
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

  console.log('[polish] suggestions:', suggestions.length)
  return { suggestions }
}

export async function summarizeChapter(
  config: LLMConfigSingle,
  content: string,
  aiConfig?: Partial<BookAIConfig>,
  mainWindow?: BrowserWindow,
  signal?: AbortSignal
): Promise<string> {
  const client = createClient(config)

  const skillPrompt = getFeatureSkillContent('summary')
  const basePrompt = skillPrompt || `你是网文写作分析助手。请对章节内容进行结构化总结，按以下格式输出（每个分类下用 - 开头的条目）：

1. 主要人物
- 人物名：状态/作用

2. 关键事件
- 事件描述

3. 伏笔
- 伏笔内容

4. 场景
- 场景描述

5. 情感
- 情感基调描述

要求：条目简洁，每个条目一行，不要展开论述。`

  const messages = [
    {
      role: 'system' as const,
      content: `${basePrompt}
${aiConfig?.summaryStandard ? '\n摘要标准：' + aiConfig.summaryStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}`
    },
    { role: 'user' as const, content }
  ]

  if (mainWindow) {
    return streamWithThinking(mainWindow, client, config, {
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
    }, signal) || '无法生成总结'
  }

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages,
    temperature: 0.3,
    ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
  })

  return response.choices[0]?.message?.content?.trim() || '无法生成总结'
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
