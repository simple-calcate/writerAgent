// ─── AI Dialogue ───

export type DialogueLevel = 'book' | 'volume' | 'chapter'

export type DialogueMode = 'chat' | 'plan'

export interface ToolCallInfo {
  id: string
  toolName: string
  displayName: string
  args: Record<string, string>
  status: 'running' | 'done' | 'pending_approval'
  result?: string
  needsApproval?: boolean
  approved?: boolean
  cachedResult?: string
  cacheHint?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: ToolCallInfo[]
  thinkingContent?: string
  reasoningChainIds?: string[]     // 用户选择的推理链 IDs
  reasoningChainNames?: string[]   // 推理链名称（用于展示）
  reasoningContext?: string        // 推理链执行结果（用于当前对话轮次）
  deleted?: boolean                // 标记消息是否被删除
}

export interface Conversation {
  id: string
  projectId: string | null
  volumeId: string | null
  chapterId: string | null
  level: 'book' | 'volume' | 'chapter'
  messages: ConversationMessage[]
  createdAt: string
  updatedAt: string
}

export interface DialogueStreamChunk {
  streamId: string
  chunk: string
}

export interface DialogueThinkingChunk {
  streamId: string
  chunk: string
}

export interface DialogueThinkingDone {
  streamId: string
}

export interface DialogueStreamDone {
  streamId: string
  fullText: string
  reasoningContext?: string  // 推理链执行结果（用于保存到对话消息中）
  cancelled?: boolean  // 任务被取消时为 true，前端应跳过保存空消息
}

export interface DialogueStreamError {
  streamId: string
  error: string
}

export interface DialogueToolStart {
  streamId: string
  toolCallId: string
  toolName: string
  args: Record<string, string>
}

export interface DialogueToolDone {
  streamId: string
  toolCallId: string
  toolName: string
  result: string
}

export interface DialogueToolApproval {
  streamId: string
  toolCallId: string
  toolName: string
  args: Record<string, string>
  approvalId: string
  displayName: string
  description: string
  cachedResult?: string
  cacheHint?: string
}

export interface DialogueToolApprovalResponse {
  approvalId: string
  approved: boolean
  refreshCache?: boolean
}

// ─── AI Thinking (通用，非对话专属) ───

export interface AIThinkingChunk {
  chunk: string
}

export interface AIThinkingDone {}

// ─── 批量摘要生成事件 ───

export interface SummaryBatchProgressEvent {
  /** 本次批量任务的 ID，前端据此过滤事件 */
  batchId: string
  /** 当前章节序号（1-based） */
  current: number
  /** 总章节数 */
  total: number
  /** 当前章节 ID */
  chapterId: string
  /** 当前章节标题（用于 UI 显示） */
  chapterTitle: string
  /** 已成功数 */
  succeeded: number
  /** 已失败数 */
  failed: number
  /** 已跳过数（如开启了"跳过最新"） */
  skipped: number
}

export interface SummaryBatchDoneEvent {
  batchId: string
  total: number
  succeeded: number
  failed: number
  skipped: number
  /** 是否被用户中途取消 */
  cancelled: boolean
  /** 失败章节明细（章节 ID + 错误信息） */
  failures: { chapterId: string; chapterTitle: string; error: string }[]
}

export interface SummaryBatchErrorEvent {
  batchId: string
  /** 致命错误（如配置缺失），批量任务直接终止 */
  error: string
}

// ─── Reasoning 事件载荷 ───

export interface ReasoningStartEvent {
  sessionId: string
  chainId: string
  chainName: string
  steps: { id: string; name: string }[]
}

export interface ReasoningStepStartEvent {
  sessionId: string
  stepId: string
  stepName: string
}

export interface ReasoningStepDoneEvent {
  sessionId: string
  stepId: string
  stepName: string
  result: string
}

export interface ReasoningStepErrorEvent {
  sessionId: string
  stepId: string
  stepName: string
  error: string
}

export interface ReasoningDoneEvent {
  sessionId: string
  status: 'running' | 'completed' | 'error'
  includeInContext: boolean
}
