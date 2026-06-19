import type { BrowserWindow } from 'electron'
import type OpenAI from 'openai'
import type { LLMConfigSingle } from '../../shared/types'
import { buildThinkingParams, hasThinkingParams } from './client'

/**
 * 通用流式 LLM 调用，捕获 reasoning_content 并通过 IPC 发送给渲染进程。
 * 适用于润色、摘要、精炼等非对话类 AI 功能。
 */
export async function streamWithThinking(
  mainWindow: BrowserWindow,
  client: OpenAI,
  config: LLMConfigSingle,
  params: Omit<OpenAI.ChatCompletionCreateParams, 'stream'>,
  signal?: AbortSignal
): Promise<string> {
  const thinkingParams = buildThinkingParams(config)

  let stream: AsyncIterable<any>
  try {
    stream = await client.chat.completions.create({
      ...params,
      stream: true,
      ...thinkingParams
    } as any, { signal }) as any
  } catch (err: any) {
    if (signal?.aborted) throw err
    // thinking params 导致 400/422，降级重试
    if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
      stream = await client.chat.completions.create({
        ...params,
        stream: true
      } as any, { signal }) as any
    } else {
      throw err
    }
  }

  let fullText = ''
  let thinkingDone = false

  for await (const chunk of stream) {
    if (signal?.aborted) break
    const delta = chunk.choices[0]?.delta

    // reasoning_content → 发送思考过程
    if ((delta as any)?.reasoning_content) {
      mainWindow.webContents.send('ai:thinking-chunk', { chunk: (delta as any).reasoning_content })
    }

    // content → 累积结果
    if (delta?.content) {
      if (!thinkingDone) {
        thinkingDone = true
        mainWindow.webContents.send('ai:thinking-done', {})
      }
      fullText += delta.content
    }
  }

  // 流结束时如果还在思考阶段，发送 done
  if (!thinkingDone) {
    mainWindow.webContents.send('ai:thinking-done', {})
  }

  return fullText
}
