import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle } from '../../shared/types'
import { createClient, buildThinkingParams, hasThinkingParams } from '../llm/client'

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AgentCallOptions {
  config: LLMConfigSingle
  messages: AgentMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  mainWindow?: BrowserWindow
  streamId?: string
}

export interface AgentCallResult {
  content: string
  reasoningContent?: string
}

/**
 * 调用 LLM 的基础函数，所有 agent 共用
 * 支持流式输出 + thinking
 */
export async function callLLM(options: AgentCallOptions): Promise<AgentCallResult> {
  const { config, messages, temperature = 0.7, maxTokens, signal, mainWindow, streamId } = options
  const client = createClient(config)

  const thinkingParams = buildThinkingParams(config)

  let stream: AsyncIterable<any>
  try {
    stream = await client.chat.completions.create({
      model: config.model || 'gpt-4o-mini',
      messages: messages as any,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      stream: true,
      ...thinkingParams
    }, { signal })
  } catch (err: any) {
    if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
      stream = await client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages: messages as any,
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
        stream: true
      }, { signal })
    } else {
      throw err
    }
  }

  let fullText = ''
  let reasoningContent = ''
  let thinkingStarted = false
  let thinkingDone = false

  for await (const chunk of stream) {
    if (signal?.aborted) break

    const delta = chunk.choices[0]?.delta

    if ((delta as any)?.reasoning_content) {
      const rc = (delta as any).reasoning_content
      reasoningContent += rc
      if (!thinkingStarted) thinkingStarted = true
      if (mainWindow && streamId) {
        mainWindow.webContents.send('agent:thinking-chunk', { streamId, chunk: rc })
      }
    }

    if (delta?.content) {
      if (thinkingStarted && !thinkingDone) {
        thinkingDone = true
        if (mainWindow && streamId) {
          mainWindow.webContents.send('agent:thinking-done', { streamId })
        }
      }
      fullText += delta.content
      if (mainWindow && streamId) {
        mainWindow.webContents.send('agent:chunk', { streamId, chunk: delta.content })
        // 桥接回前端对话系统
        mainWindow.webContents.send('dialogue:chunk', { streamId, chunk: delta.content })
      }
    }
  }

  if (thinkingStarted && !thinkingDone && mainWindow && streamId) {
    mainWindow.webContents.send('agent:thinking-done', { streamId })
  }

  return { content: fullText, reasoningContent: reasoningContent || undefined }
}

/**
 * 非流式 LLM 调用（用于 agent 内部处理，不需要流式输出给前端）
 */
export async function callLLMSync(options: AgentCallOptions): Promise<AgentCallResult> {
  const { config, messages, temperature = 0.7, maxTokens, signal } = options
  const client = createClient(config)
  const thinkingParams = buildThinkingParams(config)

  try {
    const response = await client.chat.completions.create({
      model: config.model || 'gpt-4o-mini',
      messages: messages as any,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
      ...thinkingParams
    }, { signal })

    const choice = response.choices[0]
    return {
      content: choice?.message?.content || '',
      reasoningContent: (choice?.message as any)?.reasoning_content || undefined
    }
  } catch (err: any) {
    if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
      const response = await client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages: messages as any,
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
      }, { signal })

      const choice = response.choices[0]
      return {
        content: choice?.message?.content || ''
      }
    }
    throw err
  }
}
