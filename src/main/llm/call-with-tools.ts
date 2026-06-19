import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, DialogueLevel, Project, Volume, Chapter, BookAIConfig, ContextConfig } from '../../shared/types'
import { createClient, buildThinkingParams, hasThinkingParams } from './client'
import { getDialogueTools, executeTool, needsApproval, TOOL_DISPLAY_NAMES } from './dialogue-tools'
import { waitForApproval } from './stream'

const MAX_TOOL_ROUNDS = 20

interface ToolCallAccumulator {
  id: string
  functionName: string
  arguments: string
}

export interface CallWithToolsParams {
  config: LLMConfigSingle
  mainWindow: BrowserWindow
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }>
  level: DialogueLevel
  project: Project
  volume?: Volume | null
  chapter?: Chapter | null
  allChapters?: Chapter[]
  allVolumes?: Volume[]
  aiConfig?: Partial<BookAIConfig>
  contextConfig?: ContextConfig
  temperature?: number
  signal?: AbortSignal
  streamId?: string
}

export interface CallWithToolsResult {
  content: string
  toolCallsMade: number
}

/**
 * 调用 LLM 并执行工具循环（不依赖 IPC 事件）
 * 返回最终文本结果
 */
export async function callWithTools(params: CallWithToolsParams): Promise<CallWithToolsResult> {
  const {
    config, mainWindow, messages, level, project,
    volume, chapter, allChapters = [], allVolumes = [],
    aiConfig, contextConfig, temperature = 0.7, signal, streamId
  } = params

  const client = createClient(config)
  const tools = getDialogueTools()
  const fullMessages = [...messages]
  let totalToolCalls = 0

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal?.aborted) break

    const thinkingParams = buildThinkingParams(config)
    let stream: AsyncIterable<any>
    try {
      stream = await client.chat.completions.create({
        model: config.model || 'gpt-4o-mini',
        messages: fullMessages as any,
        tools,
        temperature,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
        stream: true,
        ...thinkingParams
      }, { signal })
    } catch (err: any) {
      if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
        stream = await client.chat.completions.create({
          model: config.model || 'gpt-4o-mini',
          messages: fullMessages as any,
          tools,
          temperature,
          ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
          stream: true
        }, { signal })
      } else {
        throw err
      }
    }

    let fullText = ''
    let reasoningContent = ''
    const toolCalls: ToolCallAccumulator[] = []

    for await (const chunk of stream) {
      if (signal?.aborted) break
      const delta = chunk.choices[0]?.delta

      if ((delta as any)?.reasoning_content) {
        reasoningContent += (delta as any).reasoning_content
      }

      if (delta?.content) {
        fullText += delta.content
        if (streamId) {
          mainWindow.webContents.send('dialogue:chunk', { streamId, chunk: delta.content })
        }
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

    if (signal?.aborted) break

    // 无工具调用 → 返回结果
    if (toolCalls.length === 0 || toolCalls.every(tc => !tc.functionName)) {
      return { content: fullText, toolCallsMade: totalToolCalls }
    }

    // 有工具调用 → 执行工具
    const assistantMsg: any = {
      role: 'assistant',
      content: fullText || '',
      tool_calls: toolCalls.filter(tc => tc.functionName).map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.functionName, arguments: tc.arguments }
      }))
    }
    fullMessages.push(assistantMsg)

    for (const tc of toolCalls) {
      if (!tc.functionName) continue
      totalToolCalls++

      let args: Record<string, string> = {}
      try { args = JSON.parse(tc.arguments) } catch { /* empty */ }

      // 需要审批的工具
      if (needsApproval(tc.functionName)) {
        const approvalId = randomUUID()
        mainWindow.webContents.send('dialogue:tool-approval', {
          streamId: streamId || '',
          toolCallId: tc.id,
          toolName: tc.functionName,
          args,
          approvalId,
          displayName: TOOL_DISPLAY_NAMES[tc.functionName] || tc.functionName,
          description: `Agent 请求执行: ${tc.functionName}`
        })

        try {
          const response = await waitForApproval(approvalId)
          if (!response.approved) {
            fullMessages.push({ role: 'tool', content: '用户拒绝了操作', tool_call_id: tc.id } as any)
            continue
          }
        } catch {
          fullMessages.push({ role: 'tool', content: '操作超时', tool_call_id: tc.id } as any)
          continue
        }
      }

      // 执行工具
      if (streamId) {
        mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
      }

      try {
        const result = await executeTool(tc.functionName, args, {
          config,
          level,
          projectId: project.id,
          chapter: chapter || null,
          allChapters,
          allVolumes,
          aiConfig,
          refreshCache: true,
          mainWindow,
          dialogueMessages: [],
          executedReasoningChains: new Set(),
          contextConfig
        })

        if (streamId) {
          mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result })
        }
        fullMessages.push({ role: 'tool', content: result, tool_call_id: tc.id } as any)
      } catch (err: any) {
        const errorMsg = err.message || '工具执行失败'
        if (streamId) {
          mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: `错误：${errorMsg}` })
        }
        fullMessages.push({ role: 'tool', content: `错误：${errorMsg}`, tool_call_id: tc.id } as any)
      }
    }
  }

  // 兜底：返回最后的文本
  const lastAssistant = [...fullMessages].reverse().find(m => m.role === 'assistant')
  return { content: lastAssistant?.content || '', toolCallsMade: totalToolCalls }
}
