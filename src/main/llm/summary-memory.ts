import type { LLMConfigSingle } from '../../shared/types'
import { callLLMSync } from '../agent/base-agent'
import { estimateTokens } from './token-counter'
import { chunkText, type Chunk } from './chunking'
import { scoreChunk } from './importance-scorer'

export interface SummaryEntry {
  id: string
  originalText: string
  summary: string
  keyPoints: string[]
  tokenReduction: number    // 压缩率 (0-1)
  createdAt: string
}

const SUMMARIZE_PROMPT = `你是一位文本摘要专家。请将以下内容压缩为简洁的摘要，保留关键信息。

输出格式（严格 JSON，不要其他文字）：
{
  "summary": "200字以内的摘要",
  "keyPoints": ["关键点1", "关键点2", "关键点3"]
}

要求：
- 保留所有重要事件、人物、决策
- 保留因果关系和逻辑链
- 去除冗余描写和过渡文字
- 保持原文的核心语调`

const MERGE_SUMMARIES_PROMPT = `请将以下多个摘要合并为一个连贯的总摘要，保留所有关键信息，去除重复。

输出格式（严格 JSON，不要其他文字）：
{
  "summary": "合并后的摘要",
  "keyPoints": ["合并后的关键点"]
}`

/**
 * 使用 LLM 对长文本进行摘要压缩
 */
export async function summarizeWithLLM(
  text: string,
  config: LLMConfigSingle,
  maxSummaryTokens: number = 500,
  signal?: AbortSignal
): Promise<SummaryEntry> {
  const inputTokens = estimateTokens(text)

  // 如果文本已经很短，直接返回
  if (inputTokens <= maxSummaryTokens) {
    return {
      id: generateId(),
      originalText: text,
      summary: text,
      keyPoints: [],
      tokenReduction: 0,
      createdAt: new Date().toISOString()
    }
  }

  // 如果文本很长，先分块摘要再合并
  if (inputTokens > 4000) {
    return summarizeLongText(text, config, maxSummaryTokens, signal)
  }

  // 直接摘要
  const result = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: SUMMARIZE_PROMPT },
      { role: 'user', content: text.substring(0, 6000) }
    ],
    temperature: 0.3,
    signal
  })

  const parsed = parseSummaryResult(result.content)
  const summaryTokens = estimateTokens(parsed.summary)

  return {
    id: generateId(),
    originalText: text,
    summary: parsed.summary,
    keyPoints: parsed.keyPoints,
    tokenReduction: 1 - (summaryTokens / inputTokens),
    createdAt: new Date().toISOString()
  }
}

/**
 * 对长文本进行分块摘要再合并
 */
async function summarizeLongText(
  text: string,
  config: LLMConfigSingle,
  maxSummaryTokens: number,
  signal?: AbortSignal
): Promise<SummaryEntry> {
  const chunks = chunkText(text, { maxChunkTokens: 2000, preserveParagraphs: true })

  // 按重要性排序，取最重要的块
  const sortedChunks = [...chunks].sort((a, b) => b.score - a.score)
  const topChunks = sortedChunks.slice(0, Math.min(5, sortedChunks.length))

  // 对每个重要块进行摘要
  const chunkSummaries: string[] = []
  for (const chunk of topChunks) {
    try {
      const result = await callLLMSync({
        config,
        messages: [
          { role: 'system', content: SUMMARIZE_PROMPT },
          { role: 'user', content: chunk.content.substring(0, 3000) }
        ],
        temperature: 0.3,
        signal
      })
      const parsed = parseSummaryResult(result.content)
      chunkSummaries.push(parsed.summary)
    } catch {
      // 单块摘要失败，跳过
    }
  }

  if (chunkSummaries.length === 0) {
    // 兜底：截断
    return {
      id: generateId(),
      originalText: text,
      summary: text.substring(0, 1000) + '...',
      keyPoints: [],
      tokenReduction: 0.5,
      createdAt: new Date().toISOString()
    }
  }

  // 合并摘要
  if (chunkSummaries.length === 1) {
    const summaryTokens = estimateTokens(chunkSummaries[0])
    return {
      id: generateId(),
      originalText: text,
      summary: chunkSummaries[0],
      keyPoints: [],
      tokenReduction: 1 - (summaryTokens / estimateTokens(text)),
      createdAt: new Date().toISOString()
    }
  }

  const mergeResult = await callLLMSync({
    config,
    messages: [
      { role: 'system', content: MERGE_SUMMARIES_PROMPT },
      { role: 'user', content: chunkSummaries.map((s, i) => `摘要${i + 1}：${s}`).join('\n\n') }
    ],
    temperature: 0.3,
    signal
  })

  const merged = parseSummaryResult(mergeResult.content)
  const summaryTokens = estimateTokens(merged.summary)

  return {
    id: generateId(),
    originalText: text,
    summary: merged.summary,
    keyPoints: merged.keyPoints,
    tokenReduction: 1 - (summaryTokens / estimateTokens(text)),
    createdAt: new Date().toISOString()
  }
}

function parseSummaryResult(raw: string): { summary: string; keyPoints: string[] } {
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { summary: raw.substring(0, 500), keyPoints: [] }
    const parsed = JSON.parse(match[0])
    return {
      summary: parsed.summary || raw.substring(0, 500),
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
    }
  } catch {
    return { summary: raw.substring(0, 500), keyPoints: [] }
  }
}

function generateId(): string {
  return `sum_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
