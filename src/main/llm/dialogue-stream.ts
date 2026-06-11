import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, DialogueLevel, Project, Volume, Chapter, BookAIConfig, DialogueToolApprovalResponse, ContextConfig } from '../../shared/types'
import { DEFAULT_CONTEXT_CONFIG } from '../../shared/types'
import { createClient, buildThinkingParams, hasThinkingParams } from './client'
import { buildDialogueSystemPrompt, detectPlanMode } from './dialogue-prompts'
import { getDialogueTools, executeTool, needsApproval, isCacheable, checkCache, getToolApprovalDescription, TOOL_DISPLAY_NAMES } from './dialogue-tools'
import { getOutline, getSkills } from '../store/db'
import { getReasoningChainById, extractUserMessage } from './reasoning-chains'
import { executeReasoningChain, buildReasoningContext } from './dialogue-reasoning'
import { compressHistory, buildCompressedMessages } from './context-compressor'
import { estimateMessagesTokens, createBudget } from './token-counter'

const activeStreams = new Map<string, AbortController>()
const MAX_TOOL_ROUNDS = 50

// 裁剪旧的工具结果，防止上下文爆炸
function trimOldToolResults(messages: Array<{ role: string; content: string; tool_call_id?: string }>, contextWindow?: number, contextConfig?: ContextConfig): void {
  const config = contextConfig || DEFAULT_CONTEXT_CONFIG
  const budget = createBudget(contextWindow, contextConfig)
  const toolBudget = Math.floor(budget.available * config.toolResultBudgetRatio)

  // 找到所有工具结果消息
  const toolMessages = messages.filter(m => m.role === 'tool')
  const toolTokens = estimateMessagesTokens(toolMessages)

  if (toolTokens <= toolBudget) return

  // 从最旧的工具结果开始截断
  let excessTokens = toolTokens - toolBudget
  for (const msg of toolMessages) {
    if (excessTokens <= 0) break
    const msgTokens = estimateMessagesTokens([msg])
    if (msgTokens > 100) {  // 只截断较大的结果
      const targetTokens = Math.max(100, msgTokens - excessTokens)
      const ratio = targetTokens / msgTokens
      const targetChars = Math.floor(msg.content.length * ratio)
      msg.content = msg.content.substring(0, targetChars) + '\n\n[...结果已截断...]'
      excessTokens -= (msgTokens - targetTokens)
    }
  }
}

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
  contextConfig?: ContextConfig  // 上下文管理配置
}

interface ToolCallAccumulator {
  id: string
  functionName: string
  arguments: string
}

export async function startDialogueStream(params: StartStreamParams): Promise<{ streamId: string }> {
  const { config, mainWindow, messages, aiConfig, contextConfig, ...promptParams } = params
  const streamId = randomUUID()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const dialogueAdvanced = aiConfig?.dialogueAdvanced
  const temperature = dialogueAdvanced?.temperature ?? 0.7

  // Detect plan mode from the last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const isPlanMode = lastUserMsg ? detectPlanMode(lastUserMsg.content) : false

  // Extract reasoning chain IDs from message
  const messageChainIds: string[] = []
  if (lastUserMsg) {
    const matches = lastUserMsg.content.matchAll(/\[reasoning:([^\]]+)\]/g)
    for (const match of matches) {
      messageChainIds.push(match[1])
    }
  }

  // Run async, don't await — return streamId immediately
  ;(async () => {
    // Execute reasoning chains BEFORE starting dialogue
    let reasoningContext = ''
    const executedReasoningChains = new Set<string>()

    if (messageChainIds.length > 0) {
      // Build context for reasoning chains
      const contextParts: string[] = []
      if (params.chapter) {
        contextParts.push(`当前章节：${params.chapter.title}`)
      }

      const outlines = [
        getOutline('book', params.project.id),
        params.volume ? getOutline('volume', params.volume.id) : null,
        params.chapter ? getOutline('chapter', params.chapter.id) : null
      ].filter(Boolean)

      if (outlines.length > 0) {
        contextParts.push(`## 大纲\n${outlines.map(o => o.content).join('\n\n')}`)
      }

      // Recent dialogue history
      if (params.messages.length > 0) {
        const recentMessages = params.messages.slice(-6)
        const dialogueText = recentMessages
          .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content.substring(0, 200)}`)
          .join('\n')
        contextParts.push(`## 最近对话\n${dialogueText}`)
      }

      const reasoningChainContext = contextParts.join('\n\n')

      for (const chainId of messageChainIds) {
        if (controller.signal.aborted) break

        const chain = getReasoningChainById(chainId)
        if (!chain) continue

        executedReasoningChains.add(chain.id)

        try {
          const session = await executeReasoningChain(chain, reasoningChainContext, config, mainWindow, controller.signal)
          // Always include reasoning result for current turn, includeInContext controls persistence
          const result = buildReasoningContext(session)
          if (result) {
            reasoningContext += result
          }
        } catch (err) {
          console.error(`推理链 ${chain.name} 执行失败:`, err)
        }
      }
    }

    // Get outlines for context
    const outlines = [
      getOutline('book', params.project.id),
      params.volume ? getOutline('volume', params.volume.id) : null,
      params.chapter ? getOutline('chapter', params.chapter.id) : null
    ].filter(Boolean)

    // Get enabled skills for this project (dialogue feature)
    const allSkills = getSkills()
    const skillIds = params.project.featureSkillIds?.dialogue || params.project.enabledSkillIds || []
    const enabledSkills = skillIds.length > 0
      ? allSkills.filter(s => skillIds.includes(s.id))
      : []

    const systemPrompt = buildDialogueSystemPrompt({
      ...promptParams,
      outlines: outlines as any[],
      isPlanMode,
      skills: enabledSkills,
      reasoningContext,  // Pass reasoning context to system prompt
      contextWindow: config.contextWindow,  // Pass context window size for budget allocation
      contextConfig  // Pass context config for budget ratios
    })

    // Clean up reasoning trigger tag from messages
    const cleanedMessages = messages.map((msg, i) => {
      if (msg.role === 'user' && i === messages.length - 1) {
        return { ...msg, content: extractUserMessage(msg.content) }
      }
      return msg
    })

    // 压缩对话历史（如果超出预算）
    const compressed = compressHistory(cleanedMessages, config.contextWindow, contextConfig)
    const finalMessages = buildCompressedMessages(compressed)

    const fullMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }> = [
      { role: 'system', content: systemPrompt },
      ...finalMessages
    ]
    try {
      const client = createClient(config)
      const tools = getDialogueTools()
      const executedReasoningChains = new Set<string>()  // Track executed chains across tool calls

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) break

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
          }, { signal: controller.signal })
        } catch (err: any) {
          if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
            stream = await client.chat.completions.create({
              model: config.model || 'gpt-4o-mini',
              messages: fullMessages as any,
              tools,
              temperature,
              ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
              stream: true
            }, { signal: controller.signal })
          } else {
            throw err
          }
        }

        let fullText = ''
        let reasoningContent = ''
        let thinkingStarted = false
        let thinkingDone = false
        const toolCalls: ToolCallAccumulator[] = []

        for await (const chunk of stream) {
          if (controller.signal.aborted) break

          const delta = chunk.choices[0]?.delta

          // Capture reasoning_content and stream to renderer
          if ((delta as any)?.reasoning_content) {
            const rc = (delta as any).reasoning_content
            reasoningContent += rc
            if (!thinkingStarted) thinkingStarted = true
            mainWindow.webContents.send('dialogue:thinking-chunk', { streamId, chunk: rc })
          }

          if (delta?.content) {
            if (thinkingStarted && !thinkingDone) {
              thinkingDone = true
              mainWindow.webContents.send('dialogue:thinking-done', { streamId })
            }
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

        // Signal thinking done if stream ended during thinking phase
        if (thinkingStarted && !thinkingDone) {
          thinkingDone = true
          mainWindow.webContents.send('dialogue:thinking-done', { streamId })
        }

        if (controller.signal.aborted) break

        if (toolCalls.length === 0 || toolCalls.every(tc => !tc.functionName)) {
          mainWindow.webContents.send('dialogue:done', { streamId, fullText, reasoningContext: reasoningContext || undefined })
          return
        }

        // Add assistant message with tool_calls (and reasoning_content if present)
        const assistantMsg: any = {
          role: 'assistant',
          content: fullText || '',
          tool_calls: toolCalls.filter(tc => tc.functionName).map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.functionName, arguments: tc.arguments }
          }))
        }
        if (reasoningContent) {
          assistantMsg.reasoning_content = reasoningContent
        }
        fullMessages.push(assistantMsg)

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
              refreshCache: true,
              mainWindow,
              dialogueMessages: params.messages,
              executedReasoningChains,
              contextConfig
            })

            mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result })
            fullMessages.push({ role: 'tool', content: result, tool_call_id: tc.id } as any)
          } catch (err: any) {
            const errorMsg = err.message || '工具执行失败'
            mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: `错误：${errorMsg}` })
            fullMessages.push({ role: 'tool', content: `错误：${errorMsg}`, tool_call_id: tc.id } as any)
          }
        }

        // 裁剪旧的工具结果，防止上下文爆炸
        trimOldToolResults(fullMessages as any, config.contextWindow, contextConfig)
      }

      if (!controller.signal.aborted) {
        mainWindow.webContents.send('dialogue:done', { streamId, fullText: '', reasoningContext: reasoningContext || undefined })
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
