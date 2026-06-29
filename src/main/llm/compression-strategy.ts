import type { LLMConfigSingle, ContextConfig, ConversationMessage } from '../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../shared/types'
import { compressHistory as ruleCompressHistory, buildCompressedMessages, compressForStorage } from './context-compressor'
import { compressHistoryWithSummary } from './history-compressor'
import { createBudget } from './token-counter'
import { log } from '../utils/logger'

export interface CompressedResult {
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_call_id?: string }>
  compressedSummary: string
  totalTokenEstimate: number
  compressedCount: number
}

export interface CompressionStrategy {
  name: string
  compressHistory(
    messages: Array<{ role: string; content: string }>,
    contextWindow?: number,
    contextConfig?: ContextConfig,
    llmConfig?: LLMConfigSingle,
    signal?: AbortSignal
  ): Promise<CompressedResult>
  compressForStorage(messages: ConversationMessage[]): ConversationMessage[]
  isAvailable(): boolean
}

class RuleBasedStrategy implements CompressionStrategy {
  name = 'rule-based'

  async compressHistory(
    messages: Array<{ role: string; content: string }>,
    contextWindow?: number,
    contextConfig?: ContextConfig
  ): Promise<CompressedResult> {
    const result = ruleCompressHistory(messages, contextWindow, contextConfig)
    return {
      messages: buildCompressedMessages(result),
      compressedSummary: result.compressedSummary,
      totalTokenEstimate: result.totalTokenEstimate,
      compressedCount: result.compressedCount
    }
  }

  compressForStorage(messages: ConversationMessage[]): ConversationMessage[] {
    return compressForStorage(messages)
  }

  isAvailable(): boolean {
    return true
  }
}

class SemanticStrategy implements CompressionStrategy {
  name = 'semantic'

  async compressHistory(
    messages: Array<{ role: string; content: string }>,
    contextWindow?: number,
    contextConfig?: ContextConfig,
    llmConfig?: LLMConfigSingle,
    signal?: AbortSignal
  ): Promise<CompressedResult> {
    if (!llmConfig) {
      return ruleBasedStrategy.compressHistory(messages, contextWindow, contextConfig)
    }

    const config = contextConfig || DEFAULT_CONTEXT_CONFIG
    const budget = createBudget(contextWindow, contextConfig)
    const historyBudget = Math.floor(budget.available * config.historyBudgetRatio)

    try {
      const result = await compressHistoryWithSummary(messages, llmConfig, historyBudget, signal)

      return {
        messages: result.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content
        })),
        compressedSummary: result.summary || '',
        totalTokenEstimate: 0,
        compressedCount: messages.length - result.messages.length
      }
    } catch (err) {
      log.error('Semantic compression failed, falling back to rule-based:', err)
      return ruleBasedStrategy.compressHistory(messages, contextWindow, contextConfig)
    }
  }

  compressForStorage(messages: ConversationMessage[]): ConversationMessage[] {
    return compressForStorage(messages)
  }

  isAvailable(): boolean {
    return true
  }
}

const ruleBasedStrategy = new RuleBasedStrategy()
const semanticStrategy = new SemanticStrategy()

export function getCompressionStrategy(preferSemantic = false): CompressionStrategy {
  if (preferSemantic) {
    return semanticStrategy
  }
  return ruleBasedStrategy
}

export function getSemanticStrategy(): SemanticStrategy {
  return semanticStrategy
}
