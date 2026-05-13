import OpenAI from 'openai'
import { randomUUID } from 'crypto'
import type { LLMConfig, PolishResult, AutoPolishResult, DiffItem, BookAIConfig } from '../../shared/types'

export function createClient(config: LLMConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || 'https://api.openai.com/v1'
  })
}

// Single-segment polish with context
export async function polishText(
  config: LLMConfig,
  original: string,
  context: string
): Promise<PolishResult> {
  const client = createClient(config)

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是一位网文写作助手，专注于文风润色。你的任务是：
- 保持原文意思完全不变
- 改善用词精准度、句式节奏、描写生动度
- 不要添加原文没有的情节、人物或信息
- 不要删减原文的核心内容
- 用一句话简要说明你做了什么改动（reason字段）
- 返回严格 JSON：{"polished":"润色后文字","reason":"改动理由"}`
      },
      {
        role: 'user',
        content: `上下文（前后文，供参考风格一致性）：\n${context}\n\n请润色以下文字：\n${original}`
      }
    ],
    temperature: 0.7,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  })

  const content = response.choices[0]?.message?.content?.trim() || '{}'
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
    diffs: computeDiff(original, polished),
    accepted: false
  }
}

// Auto-detect weak segments and polish them
export async function autoPolish(
  config: LLMConfig,
  content: string,
  aiConfig?: Partial<BookAIConfig>
): Promise<AutoPolishResult> {
  const client = createClient(config)

  // Step 1: Find weak segments
  const detectResponse = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是一位网文编辑，擅长发现文字中需要改进的地方。
分析以下网文章节，找出需要润色的片段。重点关注：
- 用词平淡、缺乏表现力的句子
- 句式单一、节奏单调的段落
- 描写空洞、缺少画面感的片段
- 情感表达不够到位的地方
- 过于口语化或不够凝练的表述
${aiConfig?.polishStandard ? '\n润色标准：' + aiConfig.polishStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}

规则：
- 只选择确实需要改进的片段，不要改动已经很好的部分
- 每个片段应包含完整的句子或语义单元（至少10个字以上）
- 最多找出5个最需要改进的片段
- 返回严格 JSON：{"segments":[{"text":"原文片段","start_char":在原文中的起始位置}]}`
      },
      { role: 'user', content }
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: { type: 'json_object' }
  })

  const detectContent = detectResponse.choices[0]?.message?.content?.trim() || '{"segments":[]}'
  let segments: { text: string; start_char: number }[] = []

  try {
    const parsed = JSON.parse(detectContent)
    segments = parsed.segments || []
  } catch {
    return { suggestions: [] }
  }

  // Step 2: Polish each segment with surrounding context
  const suggestions: PolishResult[] = []

  for (const seg of segments) {
    if (!seg.text || seg.text.length < 5) continue

    // Extract context around the segment
    const segStart = content.indexOf(seg.text)
    const ctxStart = Math.max(0, segStart - 150)
    const ctxEnd = Math.min(content.length, segStart + seg.text.length + 150)
    const context = content.slice(ctxStart, ctxEnd)

    try {
      const polishResult = await polishText(config, seg.text, context)
      polishResult.position = segStart >= 0 ? segStart : seg.start_char
      suggestions.push(polishResult)
    } catch {
      // Skip failed segments
    }
  }

  return { suggestions }
}

export async function summarizeChapter(
  config: LLMConfig,
  content: string,
  aiConfig?: Partial<BookAIConfig>
): Promise<string> {
  const client = createClient(config)

  const response = await client.chat.completions.create({
    model: config.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `你是网文写作分析助手。请对章节内容进行结构化总结，按以下格式输出（每个分类下用 - 开头的条目）：

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
${aiConfig?.summaryStandard ? '\n摘要标准：' + aiConfig.summaryStandard : ''}
${aiConfig?.customPrompt ? '\n补充要求：' + aiConfig.customPrompt : ''}

要求：条目简洁，每个条目一行，不要展开论述。`
      },
      { role: 'user', content }
    ],
    temperature: 0.3,
    max_tokens: 2048
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
