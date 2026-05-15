import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, DialogueLevel, Project, Volume, Chapter, BookAIConfig, DialogueToolApprovalResponse } from '../../shared/types'
import { createClient } from './client'
import { buildDialogueSystemPrompt, detectPlanMode } from './dialogue-prompts'
import { getDialogueTools, executeTool, needsApproval, isCacheable, checkCache, getToolApprovalDescription, TOOL_DISPLAY_NAMES } from './dialogue-tools'
import { getOutline } from '../store/db'

const activeStreams = new Map<string, AbortController>()
const MAX_TOOL_ROUNDS = 50

// Approval waiting mechanism
const pendingApprovals = new Map<string, {
  resolve: (response: DialogueToolApprovalResponse) => void
  reject: (err: Error) => void
}>()

interface StartStreamParams {
  config: LLMConfigSingle
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

  // Detect plan mode from the last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const isPlanMode = lastUserMsg ? detectPlanMode(lastUserMsg.content) : false

  // Get outlines for context
  const outlines = [
    getOutline('book', params.project.id),
    params.volume ? getOutline('volume', params.volume.id) : null,
    params.chapter ? getOutline('chapter', params.chapter.id) : null
  ].filter(Boolean)

  const systemPrompt = buildDialogueSystemPrompt({
    ...promptParams,
    outlines: outlines as any[],
    isPlanMode
  })

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

          if (delta?.content) {
            fullText += delta.content
            mainWindow.webContents.send('dialogue:chunk', { streamId, chunk: delta.content })
          }

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

        if (toolCalls.length === 0 || toolCalls.every(tc => !tc.functionName)) {
          mainWindow.webContents.send('dialogue:done', { streamId, fullText })
          return
        }

        // Add assistant message with tool_calls
        fullMessages.push({
          role: 'assistant',
          content: fullText || '',
          tool_calls: toolCalls.filter(tc => tc.functionName).map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.functionName, arguments: tc.arguments }
          }))
        } as any)

        for (const tc of toolCalls) {
          if (!tc.functionName) continue

          let args: Record<string, string> = {}
          try {
            args = JSON.parse(tc.arguments)
          } catch { /* empty */ }

          // Check cache for cacheable tools
          const cacheResult = checkCache(tc.functionName, args, params.allChapters || [])
          if (cacheResult.cached && !needsApproval(tc.functionName)) {
            // Send approval request for cache hit
            const approvalId = randomUUID()
            mainWindow.webContents.send('dialogue:tool-approval', {
              streamId,
              toolCallId: tc.id,
              toolName: tc.functionName,
              args,
              approvalId,
              displayName: TOOL_DISPLAY_NAMES[tc.functionName] || tc.functionName,
              description: cacheResult.hint || '使用缓存结果？',
              cachedResult: cacheResult.result,
              cacheHint: cacheResult.hint
            })

            try {
              const response = await waitForApproval(approvalId)
              if (!response.approved) {
                // User rejected
                mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
                mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: '用户取消了操作' })
                fullMessages.push({ role: 'tool', content: '用户取消了操作', tool_call_id: tc.id } as any)
                continue
              }
              if (!response.refreshCache && cacheResult.result) {
                // Use cached result
                mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
                mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: cacheResult.result })
                fullMessages.push({ role: 'tool', content: cacheResult.result, tool_call_id: tc.id } as any)
                continue
              }
              // Fall through to execute with refresh
            } catch {
              // Approval timeout or cancelled
              mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
              mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: '操作超时' })
              fullMessages.push({ role: 'tool', content: '操作超时', tool_call_id: tc.id } as any)
              continue
            }
          }

          // Check if tool needs approval (write operations)
          if (needsApproval(tc.functionName)) {
            const approvalId = randomUUID()
            mainWindow.webContents.send('dialogue:tool-approval', {
              streamId,
              toolCallId: tc.id,
              toolName: tc.functionName,
              args,
              approvalId,
              displayName: TOOL_DISPLAY_NAMES[tc.functionName] || tc.functionName,
              description: getToolApprovalDescription(tc.functionName, args)
            })

            try {
              const response = await waitForApproval(approvalId)
              if (!response.approved) {
                mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
                mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: '用户拒绝了操作' })
                fullMessages.push({ role: 'tool', content: '用户拒绝了操作，请告知用户该操作已被取消', tool_call_id: tc.id } as any)
                continue
              }
            } catch {
              mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
              mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: '操作超时' })
              fullMessages.push({ role: 'tool', content: '操作超时', tool_call_id: tc.id } as any)
              continue
            }
          }

          // Execute tool
          mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })

          try {
            const result = await executeTool(tc.functionName, args, {
              config,
              level: params.level,
              projectId: params.project.id,
              chapter: params.chapter || null,
              allChapters: params.allChapters || [],
              allVolumes: params.allVolumes || [],
              aiConfig,
              refreshCache: true
            })

            mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result })
            fullMessages.push({ role: 'tool', content: result, tool_call_id: tc.id } as any)
          } catch (err: any) {
            const errorMsg = err.message || '工具执行失败'
            mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: `错误：${errorMsg}` })
            fullMessages.push({ role: 'tool', content: `错误：${errorMsg}`, tool_call_id: tc.id } as any)
          }
        }
      }

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

function waitForApproval(approvalId: string): Promise<DialogueToolApprovalResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingApprovals.delete(approvalId)
      reject(new Error('审批超时'))
    }, 5 * 60 * 1000) // 5 minute timeout

    pendingApprovals.set(approvalId, {
      resolve: (response) => {
        clearTimeout(timeout)
        pendingApprovals.delete(approvalId)
        resolve(response)
      },
      reject: (err) => {
        clearTimeout(timeout)
        pendingApprovals.delete(approvalId)
        reject(err)
      }
    })
  })
}

export function handleApprovalResponse(response: DialogueToolApprovalResponse): void {
  const pending = pendingApprovals.get(response.approvalId)
  if (pending) {
    pending.resolve(response)
  }
}

export function cancelDialogueStream(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}
