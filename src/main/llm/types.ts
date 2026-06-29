/**
 * LLM 相关扩展类型
 *
 * openai SDK 的类型定义不含国产模型（deepseek/qwen 等）的非标字段，
 * 这里通过类型扩展补齐，避免在调用处用 `as any` 绕过类型检查。
 */
import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/resources/chat/completions'

/**
 * 带思维链的 Delta（deepseek-r1 / qwen / glm 等模型的非标字段）。
 * 流式响应中每个 chunk 的 delta，扩展了 reasoning_content。
 */
export type ReasoningDelta = ChatCompletionChunk.Choice.Delta & {
  reasoning_content?: string | null
}

/**
 * 带思维链的完整消息（用于保存 assistant 消息）。
 * ChatCompletionMessageParam 是 union 类型，用交叉类型补 reasoning_content。
 */
export type ReasoningMessage = ChatCompletionMessageParam & {
  reasoning_content?: string
}
