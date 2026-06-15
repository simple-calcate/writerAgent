import type { ContextConfig } from '../../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../../shared/types'
import { estimateMessagesTokens, createBudget } from '../token-counter'
import { getCompressionStrategy } from '../compression-strategy'

export function trimOldToolResults(messages: Array<{ role: string; content: string; tool_call_id?: string }>, contextWindow?: number, contextConfig?: ContextConfig): void {
  const config = contextConfig || DEFAULT_CONTEXT_CONFIG
  const budget = createBudget(contextWindow, contextConfig)
  const toolBudget = Math.floor(budget.available * config.toolResultBudgetRatio)

  const toolMessages = messages.filter(m => m.role === 'tool')
  const toolTokens = estimateMessagesTokens(toolMessages)

  if (toolTokens <= toolBudget) return

  let excessTokens = toolTokens - toolBudget
  for (const msg of toolMessages) {
    if (excessTokens <= 0) break
    const msgTokens = estimateMessagesTokens([msg])
    if (msgTokens > 100) {
      const targetTokens = Math.max(100, msgTokens - excessTokens)
      const ratio = targetTokens / msgTokens
      const targetChars = Math.floor(msg.content.length * ratio)
      msg.content = msg.content.substring(0, targetChars) + '\n\n[...结果已截断...]'
      excessTokens -= (msgTokens - targetTokens)
    }
  }
}

export function compressDialogueHistory(messages: Array<{ role: string; content: string }>, contextWindow?: number, contextConfig?: ContextConfig) {
  const strategy = getCompressionStrategy(contextConfig?.compressionStrategy === 'semantic')
  return strategy.compressHistory(messages, contextWindow, contextConfig)
}
