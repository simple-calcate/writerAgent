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
