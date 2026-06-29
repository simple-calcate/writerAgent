import { randomUUID } from 'crypto'
import { errorMessage, hasErrorStatus } from '../utils/errors'
import type { ReasoningDelta } from './types'
import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, DialogueLevel, Project, Volume, Chapter, BookAIConfig, ContextConfig } from '../../shared/types'
import { createClient, buildThinkingParams, hasThinkingParams } from './client'
import { buildDialogueSystemPrompt, detectPlanMode } from './dialogue-prompts'
import { getDialogueTools, executeTool, needsApproval, isCacheable, checkCache, getToolApprovalDescription, TOOL_DISPLAY_NAMES } from './dialogue-tools'
import { getOutline, getSkills } from '../store/db'
import { getReasoningChainById, extractUserMessage } from './reasoning-chains'
import { executeReasoningChain, buildReasoningContext } from './dialogue-reasoning'
import { waitForApproval, handleApprovalResponse, trimOldToolResults, compressDialogueHistory } from './stream'
import { log } from '../utils/logger'

const activeStreams = new Map<string, AbortController>()
const MAX_TOOL_ROUNDS = 50

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
  contextConfig?: ContextConfig
}

interface ToolCallAccumulator {
  id: string
  functionName: string
  arguments: string
}

export async function startDialogueStream(params: StartStreamParams): Promise<{ streamId: string }> {
  const { config, mainWindow, messages, aiConfig, contextConfig, ...promptParams } = params
  const { project, level } = params
  const streamId = randomUUID()
  const controller = new AbortController()
  activeStreams.set(streamId, controller)

  const dialogueAdvanced = aiConfig?.dialogueAdvanced
  const temperature = dialogueAdvanced?.temperature ?? 0.7

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const isPlanMode = lastUserMsg ? detectPlanMode(lastUserMsg.content) : false

  const messageChainIds: string[] = []
  if (lastUserMsg) {
    const matches = lastUserMsg.content.matchAll(/\[reasoning:([^\]]+)\]/g)
    for (const match of matches) {
      messageChainIds.push(match[1])
    }
  }

  ;(async () => {
    let reasoningContext = ''
    const executedReasoningChains = new Set<string>()

    if (messageChainIds.length > 0) {
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
        contextParts.push(`## 大纲\n${outlines.map(o => o!.content).join('\n\n')}`)
      }

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
          const result = buildReasoningContext(session)
          if (result) {
            reasoningContext += result
          }
        } catch (err) {
          log.error(`推理链 ${chain.name} 执行失败:`, err)
        }
      }
    }

    const outlines = [
      getOutline('book', params.project.id),
      params.volume ? getOutline('volume', params.volume.id) : null,
      params.chapter ? getOutline('chapter', params.chapter.id) : null
    ].filter(Boolean)

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
      reasoningContext,
      contextWindow: config.contextWindow,
      contextConfig
    })

    const cleanedMessages = messages.map((msg, i) => {
      if (msg.role === 'user' && i === messages.length - 1) {
        return { ...msg, content: extractUserMessage(msg.content) }
      }
      return msg
    })

    trimOldToolResults(cleanedMessages, config.contextWindow, contextConfig)

    const compressed = await compressDialogueHistory(cleanedMessages, config.contextWindow, contextConfig, config, controller.signal)
    const finalMessages = compressed.messages

    // 语义压缩产出的摘要写入记忆系统
    if (compressed.compressedSummary && compressed.compressedCount > 0) {
      const { recordMemory } = await import('../memory/manager')
      recordMemory({ type: 'dialogue_compressed', projectId: project.id, level, entityId: project.id, summary: compressed.compressedSummary, messageCount: compressed.compressedCount })
    }

    const fullMessages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; reasoning_content?: string }> = [
      { role: 'system', content: systemPrompt },
      ...finalMessages
    ]
    try {
      const client = createClient(config)
      const tools = getDialogueTools()
      const executedReasoningChains = new Set<string>()

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
        } catch (err) {
          if (hasThinkingParams(config) && hasErrorStatus(err, 400, 422)) {
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

          if ((delta as ReasoningDelta)?.reasoning_content) {
            const rc = (delta as ReasoningDelta).reasoning_content
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

        if (thinkingStarted && !thinkingDone) {
          thinkingDone = true
          mainWindow.webContents.send('dialogue:thinking-done', { streamId })
        }

        if (controller.signal.aborted) break

        if (toolCalls.length === 0 || toolCalls.every(tc => !tc.functionName)) {
          mainWindow.webContents.send('dialogue:done', { streamId, fullText, reasoningContext: reasoningContext || undefined })
          return
        }

        const assistantMsg: { role: 'assistant'; content: string; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; reasoning_content?: string } = {
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

          const cacheResult = checkCache(tc.functionName, args, params.allChapters || [])
          if (cacheResult.cached && !needsApproval(tc.functionName)) {
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
                mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
                mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: '用户取消了操作' })
                fullMessages.push({ role: 'tool', content: '用户取消了操作', tool_call_id: tc.id } as any)
                continue
              }
              if (!response.refreshCache && cacheResult.result) {
                mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
                mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: cacheResult.result })
                fullMessages.push({ role: 'tool', content: cacheResult.result, tool_call_id: tc.id } as any)
                continue
              }
            } catch {
              mainWindow.webContents.send('dialogue:tool-start', { streamId, toolCallId: tc.id, toolName: tc.functionName, args })
              mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: '操作超时' })
              fullMessages.push({ role: 'tool', content: '操作超时', tool_call_id: tc.id } as any)
              continue
            }
          }

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
              dialogueMessages: params.messages.map(m => ({ ...m, id: '', timestamp: '' })) as any,
              executedReasoningChains,
              contextConfig
            })

            mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result })
            fullMessages.push({ role: 'tool', content: result, tool_call_id: tc.id } as any)
          } catch (err) {
            const errorMsg = errorMessage(err) || '工具执行失败'
            mainWindow.webContents.send('dialogue:tool-done', { streamId, toolCallId: tc.id, toolName: tc.functionName, result: `错误：${errorMsg}` })
            fullMessages.push({ role: 'tool', content: `错误：${errorMsg}`, tool_call_id: tc.id } as any)
          }
        }
      }

      if (!controller.signal.aborted) {
        mainWindow.webContents.send('dialogue:done', { streamId, fullText: '', reasoningContext: reasoningContext || undefined })
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const errorMsg = errorMessage(err) || '对话生成失败'
      mainWindow.webContents.send('dialogue:error', { streamId, error: errorMsg })
    } finally {
      activeStreams.delete(streamId)
    }
  })()

  return { streamId }
}

export { handleApprovalResponse }

export function cancelDialogueStream(streamId: string): void {
  const controller = activeStreams.get(streamId)
  if (controller) {
    controller.abort()
    activeStreams.delete(streamId)
  }
}
