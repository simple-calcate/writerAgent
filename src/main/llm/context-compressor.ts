import type { LLMConfigSingle, ContextConfig, ConversationMessage, Conversation } from '../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../shared/types'
import { estimateTokens, estimateMessagesTokens, createBudget } from './token-counter'

export interface CompressedHistory {
  recentMessages: Array<{ role: string; content: string }>
  compressedSummary: string
  totalTokenEstimate: number
  compressedCount: number
}

/**
 * 压缩对话历史
 * 当消息总 token 超出预算时，将旧消息压缩为摘要
 */
export function compressHistory(
  messages: Array<{ role: string; content: string }>,
  contextWindow?: number,
  contextConfig?: ContextConfig
): CompressedHistory {
  const config = contextConfig || DEFAULT_CONTEXT_CONFIG
  const budget = createBudget(contextWindow, contextConfig)
  const historyBudget = Math.floor(budget.available * config.historyBudgetRatio)

  const totalTokens = estimateMessagesTokens(messages)

  // 未超预算，不压缩
  if (totalTokens <= historyBudget) {
    return {
      recentMessages: messages,
      compressedSummary: '',
      totalTokenEstimate: totalTokens,
      compressedCount: 0
    }
  }

  // 计算需要保留的消息数
  const keepRecent = config.keepRecentRounds
  const recentMessages = messages.slice(-keepRecent)
  const recentTokens = estimateMessagesTokens(recentMessages)

  // 如果最近消息已经超出预算，进一步裁剪
  if (recentTokens > historyBudget) {
    // 按比例保留
    const ratio = historyBudget / recentTokens
    const keepCount = Math.max(5, Math.floor(recentMessages.length * ratio))
    const trimmedRecent = recentMessages.slice(-keepCount)
    const trimmedTokens = estimateMessagesTokens(trimmedRecent)

    return {
      recentMessages: trimmedRecent,
      compressedSummary: '',
      totalTokenEstimate: trimmedTokens,
      compressedCount: messages.length - keepCount
    }
  }

  // 需要压缩的旧消息
  const toCompress = messages.slice(0, -keepRecent)
  const compressedCount = toCompress.length

  // 生成简单摘要（基于消息内容提取关键信息）
  const summary = generateSimpleSummary(toCompress, config.summaryBudget)

  return {
    recentMessages,
    compressedSummary: summary,
    totalTokenEstimate: estimateTokens(summary) + recentTokens,
    compressedCount
  }
}

/**
 * 生成简单摘要（不调用 LLM，基于规则提取）
 */
function generateSimpleSummary(messages: Array<{ role: string; content: string }>, summaryBudget: number): string {
  const keyPoints: string[] = []

  // 根据摘要预算调整截取长度
  const maxUserLength = Math.max(50, Math.floor(summaryBudget * 0.15))
  const maxAiLength = Math.max(50, Math.floor(summaryBudget * 0.15))

  // 提取用户消息的关键意图
  const userMessages = messages.filter(m => m.role === 'user')
  if (userMessages.length > 0) {
    // 取最近 3 条用户消息
    const recentUser = userMessages.slice(-3).map(m =>
      m.content.length > maxUserLength ? m.content.substring(0, maxUserLength) + '...' : m.content
    )
    keyPoints.push(`用户最近关注：${recentUser.join('；')}`)
  }

  // 提取 AI 的关键建议
  const aiMessages = messages.filter(m => m.role === 'assistant')
  if (aiMessages.length > 0) {
    // 取最近 2 条 AI 消息
    const recentAi = aiMessages.slice(-2).map(m =>
      m.content.length > maxAiLength ? m.content.substring(0, maxAiLength) + '...' : m.content
    )
    keyPoints.push(`AI 最近建议：${recentAi.join('；')}`)
  }

  // 提取工具调用记录
  const toolMessages = messages.filter(m => m.role === 'tool')
  if (toolMessages.length > 0) {
    keyPoints.push(`执行了 ${toolMessages.length} 次工具调用`)
  }

  return `【对话历史摘要（共 ${messages.length} 条消息）】\n${keyPoints.join('\n')}`
}

// ─── 持久化压缩 ───

const STORAGE_KEEP_RECENT = 10  // 最近 10 条消息保留完整详情
const STORAGE_MAX_TOOL_RESULT = 300  // 旧工具结果最多保留 300 字符
const STORAGE_MAX_THINKING = 200  // 旧思考内容最多保留 200 字符
const STORAGE_MAX_CONTENT = 2000  // 旧消息内容最多保留 2000 字符

/**
 * 压缩对话用于持久化存储
 * - 最近 N 条消息保留完整
 * - 更早的消息：截断 thinkingContent、工具结果、过长内容
 * - 删除已标记 deleted 的消息
 */
export function compressForStorage(messages: ConversationMessage[]): ConversationMessage[] {
  // 先过滤已删除的消息
  const alive = messages.filter(m => !m.deleted)
  if (alive.length <= STORAGE_KEEP_RECENT) return alive

  const recent = alive.slice(-STORAGE_KEEP_RECENT)
  const old = alive.slice(0, -STORAGE_KEEP_RECENT)

  const compressedOld = old.map(msg => {
    const compressed = { ...msg }

    // 截断思考内容
    if (compressed.thinkingContent && compressed.thinkingContent.length > STORAGE_MAX_THINKING) {
      compressed.thinkingContent = compressed.thinkingContent.substring(0, STORAGE_MAX_THINKING) + '...[已截断]'
    }

    // 截断推理上下文
    if (compressed.reasoningContext && compressed.reasoningContext.length > STORAGE_MAX_THINKING) {
      compressed.reasoningContext = compressed.reasoningContext.substring(0, STORAGE_MAX_THINKING) + '...[已截断]'
    }

    // 压缩工具调用结果
    if (compressed.toolCalls) {
      compressed.toolCalls = compressed.toolCalls.map(tc => {
        const compressedTc = { ...tc }
        // 移除临时缓存字段
        delete compressedTc.cachedResult
        delete compressedTc.cacheHint
        // 截断结果
        if (compressedTc.result && compressedTc.result.length > STORAGE_MAX_TOOL_RESULT) {
          compressedTc.result = compressedTc.result.substring(0, STORAGE_MAX_TOOL_RESULT) + '...[已截断]'
        }
        return compressedTc
      })
    }

    // 截断过长内容
    if (compressed.content && compressed.content.length > STORAGE_MAX_CONTENT) {
      compressed.content = compressed.content.substring(0, STORAGE_MAX_CONTENT) + '...[已截断]'
    }

    return compressed
  })

  return [...compressedOld, ...recent]
}

/**
 * 压缩整个对话对象用于持久化
 */
export function compressConversationForStorage(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: compressForStorage(conversation.messages)
  }
}

/**
 * 将压缩后的消息数组注入到完整消息流中
 * 返回格式：[压缩摘要（如有）, 最近消息]
 */
export function buildCompressedMessages(
  compressed: CompressedHistory
): Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }> {
  const result: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }> = []

  if (compressed.compressedSummary) {
    result.push({
      role: 'system',
      content: compressed.compressedSummary
    })
  }

  result.push(...compressed.recentMessages.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system' | 'tool',
    content: m.content
  })))
  return result
}

/**
 * 手动压缩对话消息（用于 /compress 命令）
 * 返回压缩后的 ConversationMessage 数组和摘要
 */
export function compressConversationMessages(
  messages: ConversationMessage[],
  contextWindow?: number,
  contextConfig?: ContextConfig
): { messages: ConversationMessage[]; summary: string; compressedCount: number } {
  const config = contextConfig || DEFAULT_CONTEXT_CONFIG
  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }))
  const result = compressHistory(apiMessages, contextWindow, contextConfig)

  if (result.compressedCount === 0) {
    return { messages, summary: '', compressedCount: 0 }
  }

  const keepRecent = config.keepRecentRounds
  const recentMessages = messages.slice(-keepRecent)

  const summaryMsg: ConversationMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: result.compressedSummary,
    timestamp: new Date().toISOString()
  }

  return {
    messages: [summaryMsg, ...recentMessages],
    summary: result.compressedSummary,
    compressedCount: result.compressedCount
  }
}
