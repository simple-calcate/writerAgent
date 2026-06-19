import type { LLMConfigSingle } from '../../shared/types'
import { estimateTokens } from './token-counter'
import { summarizeWithLLM, type SummaryEntry } from './summary-memory'

/**
 * 对对话历史进行智能摘要压缩
 * 结合重要性评分，保留高价值消息，压缩低价值消息
 */
export async function compressHistoryWithSummary(
  messages: Array<{ role: string; content: string }>,
  config: LLMConfigSingle,
  targetTokens: number,
  signal?: AbortSignal
): Promise<{ messages: Array<{ role: string; content: string }>; summary?: string }> {
  const totalTokens = estimateTokens(messages.map(m => m.content).join('\n'))

  if (totalTokens <= targetTokens) {
    return { messages }
  }

  const excessTokens = totalTokens - targetTokens
  const compressedMessages: Array<{ role: string; content: string }> = []
  const toSummarize: string[] = []
  let savedTokens = 0

  for (const msg of messages) {
    const msgTokens = estimateTokens(msg.content)
    if (savedTokens < excessTokens && toSummarize.length < messages.length - 3) {
      toSummarize.push(`[${msg.role}] ${msg.content}`)
      savedTokens += msgTokens
    } else {
      compressedMessages.push(msg)
    }
  }

  if (toSummarize.length === 0) {
    return { messages }
  }

  try {
    const summaryEntry = await summarizeWithLLM(
      toSummarize.join('\n\n'),
      config,
      Math.min(500, targetTokens * 0.3),
      signal
    )

    return {
      messages: [
        { role: 'system', content: `【对话历史摘要】\n${summaryEntry.summary}` },
        ...compressedMessages
      ],
      summary: summaryEntry.summary
    }
  } catch {
    return { messages: messages.slice(-10) }
  }
}
