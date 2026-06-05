import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, DialogueLevel, Project, Volume, Chapter, BookAIConfig, DialogueToolApprovalResponse, ReasoningChain, ReasoningStepResult, ReasoningSession } from '../../shared/types'
import { createClient, buildThinkingParams, hasThinkingParams } from './client'
import { buildDialogueSystemPrompt, detectPlanMode } from './dialogue-prompts'
import { getDialogueTools, executeTool, needsApproval, isCacheable, checkCache, getToolApprovalDescription, TOOL_DISPLAY_NAMES } from './dialogue-tools'
import { getOutline, getSkills } from '../store/db'
import { buildStepPrompt, getReasoningChainById, extractUserMessage } from './reasoning-chains'

const activeStreams = new Map<string, AbortController>()
const MAX_TOOL_ROUNDS = 50

// ─── Reasoning Chain Execution ───

export async function executeReasoningChain(
  chain: ReasoningChain,
  context: string,
  config: LLMConfigSingle,
  mainWindow: BrowserWindow,
  signal?: AbortSignal
): Promise<ReasoningSession> {
  const sessionId = randomUUID()
  const session: ReasoningSession = {
    id: sessionId,
    chainId: chain.id,
    chainName: chain.name,
    steps: [],
    context,
    status: 'running',
    includeInContext: chain.includeInContext,
    createdAt: new Date().toISOString()
  }

  // Notify start
  mainWindow.webContents.send('dialogue:reasoning-start', {
    sessionId,
    chainId: chain.id,
    chainName: chain.name,
    steps: chain.steps.map(s => ({ id: s.id, name: s.name }))
  })

  const results: Record<string, string> = {}

  try {
    const client = createClient(config)

    for (const step of chain.steps) {
      if (signal?.aborted) break

      const stepResult: ReasoningStepResult = {
        chainId: chain.id,
        stepId: step.id,
        stepName: step.name,
        result: '',
        status: 'running'
      }
      session.steps.push(stepResult)

      // Notify step start
      mainWindow.webContents.send('dialogue:reasoning-step-start', {
        sessionId,
        stepId: step.id,
        stepName: step.name
      })

      try {
        const stepPrompt = buildStepPrompt(step, results, context)

        const thinkingParams = buildThinkingParams(config)
        let response: any
        try {
          response = await client.chat.completions.create({
            model: config.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: '你是一位专业的写作分析助手。请根据任务说明进行分析，输出具体、可操作的分析结果。' },
              { role: 'user', content: stepPrompt }
            ],
            temperature: 0.7,
            ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
            ...thinkingParams
          }, { signal })
        } catch (err: any) {
          if (hasThinkingParams(config) && (err.status === 400 || err.status === 422)) {
            response = await client.chat.completions.create({
              model: config.model || 'gpt-4o-mini',
              messages: [
                { role: 'system', content: '你是一位专业的写作分析助手。请根据任务说明进行分析，输出具体、可操作的分析结果。' },
                { role: 'user', content: stepPrompt }
              ],
              temperature: 0.7,
              ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
            }, { signal })
          } else {
            throw err
          }
        }

        const result = response.choices[0]?.message?.content?.trim() || '分析失败'
        results[step.outputKey] = result
        stepResult.result = result
        stepResult.status = 'done'

        // Notify step complete
        mainWindow.webContents.send('dialogue:reasoning-step-done', {
          sessionId,
          stepId: step.id,
          stepName: step.name,
          result
        })
      } catch (err: any) {
        if (signal?.aborted) break
        stepResult.status = 'error'
        stepResult.result = `错误: ${err.message}`

        mainWindow.webContents.send('dialogue:reasoning-step-error', {
          sessionId,
          stepId: step.id,
          stepName: step.name,
          error: err.message
        })
      }
    }

    session.status = signal?.aborted ? 'error' : 'completed'
  } catch (err: any) {
    session.status = 'error'
  }

  // Notify complete
  mainWindow.webContents.send('dialogue:reasoning-done', {
    sessionId,
    status: session.status,
    includeInContext: chain.includeInContext
  })

  return session
}

// Build reasoning context for injection into system prompt
export function buildReasoningContext(session: ReasoningSession, forceInclude = false): string {
  // Always build context if session is completed, regardless of includeInContext setting
  // The includeInContext flag now controls whether to persist across conversation turns
  if (session.status !== 'completed') return ''

  let context = `\n## 推理分析（${session.chainName}）\n`
  for (const step of session.steps) {
    if (step.status === 'done') {
      context += `\n### ${step.stepName}\n${step.result}\n`
    }
  }
  return context
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
      reasoningContext  // Pass reasoning context to system prompt
    })

    // Clean up reasoning trigger tag from messages
    const cleanedMessages = messages.map((msg, i) => {
      if (msg.role === 'user' && i === messages.length - 1) {
        return { ...msg, content: extractUserMessage(msg.content) }
      }
      return msg
    })

    const fullMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }> = [
      { role: 'system', content: systemPrompt },
      ...cleanedMessages
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
            temperature: 0.7,
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
              temperature: 0.7,
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
              executedReasoningChains
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
