import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfig, DialogueLevel, Project, Volume, Chapter, BookAIConfig } from '../../shared/types'
import { createClient } from './client'
import { buildDialogueSystemPrompt } from './dialogue-prompts'
import { getDialogueTools, executeTool } from './dialogue-tools'

const activeStreams = new Map<string, AbortController>()
const MAX_TOOL_ROUNDS = 5

interface StartStreamParams {
  config: LLMConfig
  mainWindow: BrowserWindow
  level: DialogueLevel
  project: Project
  volume?: Volume | null
  chapter?: Chapter | null
  allVolumes?: Volume[]
  allChapters?: Chapter[]
  aiConfig?: Partial<BookAIConfig>
  messages: { role: 'user' | 'assistant'; content: string }[]
}

interface ToolCallAccumulator {
  id: string
  functionName: string
  arguments: string
}

export async function startDialogueStream(params: StartStreamParams): Promise<{ streamId: string }> {
  const { config, mainWindow, messages, aiConfig, ...promptParams } = params
  const streamId = randomUUID()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const systemPrompt = buildDialogueSystemPrompt(promptParams)

  const fullMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages
  ]

  // Run async, don't await — return streamId immediately
  ;(async () => {
    try {
      const client = createClient(config)
      const tools = getDialogueTools()

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) break

        const stream = await client.chat.completions.create({
          model: config.model || 'gpt-4o-mini',
          messages: fullMessages as any,
          tools,
          temperature: 0.7,
          max_tokens: 4096,
          stream: true
        }, { signal: controller.signal })

        let fullText = ''
        const toolCalls: ToolCallAccumulator[] = []

        for await (const chunk of stream) {
          if (controller.signal.aborted) break

          const delta = chunk.choices[0]?.delta

          // Handle text content
          if (delta?.content) {
            fullText += delta.content
            mainWindow.webContents.send('dialogue:chunk', { streamId, chunk: delta.content })
          }

          // Handle tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index ?? 0
              if (!toolCalls[index]) {
                toolCalls[index] = { id: tc.id || '', functionName: '', arguments: '' }
              }
              if (tc.id) toolCalls[index].id = tc.id
              if (tc.function?.name) toolCalls[index].functionName = tc.function.name
              if (tc.function?.arguments) toolCalls[index].arguments += tc.function.arguments
            }
          }
        }

        if (controller.signal.aborted) break

        // If no tool calls, we're done
        if (toolCalls.length === 0 || toolCalls.every(tc => !tc.functionName)) {
          mainWindow.webContents.send('dialogue:done', { streamId, fullText })
          return
        }

        // Execute tool calls
        // Add assistant message with tool_calls to history
        fullMessages.push({
          role: 'assistant',
          content: fullText || '',
          tool_call_id: undefined
        } as any)

        for (const tc of toolCalls) {
          if (!tc.functionName) continue

          let args: Record<string, string> = {}
          try {
            args = JSON.parse(tc.arguments)
          } catch { /* empty args */ }

          // Notify renderer: tool started
          mainWindow.webContents.send('dialogue:tool-start', {
            streamId,
            toolCallId: tc.id,
            toolName: tc.functionName,
            args
          })

          try {
            const result = await executeTool(tc.functionName, args, {
              config,
              chapter: params.chapter || null,
              allChapters: params.allChapters || [],
              aiConfig
            })

            // Notify renderer: tool done
            mainWindow.webContents.send('dialogue:tool-done', {
              streamId,
              toolCallId: tc.id,
              toolName: tc.functionName,
              result
            })

            // Add tool result to messages for next round
            fullMessages.push({
              role: 'tool',
              content: result,
              tool_call_id: tc.id
            } as any)
          } catch (err: any) {
            const errorMsg = err.message || '工具执行失败'
            mainWindow.webContents.send('dialogue:tool-done', {
              streamId,
              toolCallId: tc.id,
              toolName: tc.functionName,
              result: `错误：${errorMsg}`
            })

            fullMessages.push({
              role: 'tool',
              content: `错误：${errorMsg}`,
              tool_call_id: tc.id
            } as any)
          }
        }

        // Continue to next round — the LLM will process tool results
      }

      // If we exhausted all rounds, send done
      if (!controller.signal.aborted) {
        mainWindow.webContents.send('dialogue:done', { streamId, fullText: '' })
      }
    } catch (err: any) {
      if (controller.signal.aborted) return
      const errorMsg = err.message || '对话生成失败'
      mainWindow.webContents.send('dialogue:error', { streamId, error: errorMsg })
    } finally {
      activeStreams.delete(streamId)
    }
  })()

  return { streamId }
}

export function cancelDialogueStream(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}
