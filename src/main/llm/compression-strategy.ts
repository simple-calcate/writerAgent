import type { ContextConfig, ConversationMessage } from '../../shared/types'
import { compressHistory, buildCompressedMessages, compressForStorage } from './context-compressor'

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
    contextConfig?: ContextConfig
  ): CompressedResult
  compressForStorage(messages: ConversationMessage[]): ConversationMessage[]
  isAvailable(): boolean
}

class RuleBasedStrategy implements CompressionStrategy {
  name = 'rule-based'

  compressHistory(
    messages: Array<{ role: string; content: string }>,
    contextWindow?: number,
    contextConfig?: ContextConfig
  ): CompressedResult {
    const result = compressHistory(messages, contextWindow, contextConfig)
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
  private headroomModule: any = null
  private loadAttempted = false

  async loadHeadroom(): Promise<boolean> {
    if (this.loadAttempted) return this.headroomModule !== null
    this.loadAttempted = true
    
    try {
      // 使用 Function 构造器避免 TypeScript 和 Vite 的静态分析
      const dynamicImport = new Function('specifier', 'return import(specifier)')
      this.headroomModule = await dynamicImport('headroom-ai')
      return true
    } catch {
      console.warn('headroom-ai not installed, falling back to rule-based compression')
      return false
    }
  }

  async compressHistoryAsync(
    messages: Array<{ role: string; content: string }>,
    contextWindow?: number,
    contextConfig?: ContextConfig
  ): Promise<CompressedResult> {
    if (!await this.loadHeadroom()) {
      return getRuleBasedStrategy().compressHistory(messages, contextWindow, contextConfig)
    }

    try {
      const result = await this.headroomModule.compress(messages, {
        model: 'kompress-v2-base',
        targetRatio: 0.3
      })
      
      return {
        messages: result.compressed || messages,
        compressedSummary: result.summary || '',
        totalTokenEstimate: result.tokenCount || 0,
        compressedCount: messages.length - (result.compressed?.length || messages.length)
      }
    } catch (err) {
      console.error('Headroom compression failed, falling back:', err)
      return getRuleBasedStrategy().compressHistory(messages, contextWindow, contextConfig)
    }
  }

  compressHistory(
    messages: Array<{ role: string; content: string }>,
    contextWindow?: number,
    contextConfig?: ContextConfig
  ): CompressedResult {
    // 同步回退到规则式
    return getRuleBasedStrategy().compressHistory(messages, contextWindow, contextConfig)
  }

  compressForStorage(messages: ConversationMessage[]): ConversationMessage[] {
    return getRuleBasedStrategy().compressForStorage(messages)
  }

  isAvailable(): boolean {
    return this.headroomModule !== null
  }
}

const ruleBasedStrategy = new RuleBasedStrategy()
const semanticStrategy = new SemanticStrategy()

function getRuleBasedStrategy(): RuleBasedStrategy {
  return ruleBasedStrategy
}

export function getCompressionStrategy(preferSemantic = false): CompressionStrategy {
  if (preferSemantic && semanticStrategy.isAvailable()) {
    return semanticStrategy
  }
  return ruleBasedStrategy
}

export function getSemanticStrategy(): SemanticStrategy {
  return semanticStrategy
}
