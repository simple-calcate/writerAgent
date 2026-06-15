import type { BrowserWindow } from 'electron'
import type { LLMConfigSingle, BookAIConfig, Chapter, Volume, DialogueLevel, ReasoningChain, ConversationMessage, ProjectReasoningConfig, ContextConfig } from '../../../shared/types'
import { DEFAULT_REASONING_CONTEXT_CONFIG } from '../../../shared/types'
import { createChapter, createVolume, renameChapter, getProjects, getOutline } from '../../store/db'
import { getReasoningChains, findReasoningChain } from '../reasoning-chains'
import { handleChapterTools, handleOutlineTools, handleSkillTools, handleReasoningTools, handleSearchTools } from './handlers'

export interface ExecuteToolParams {
  config: LLMConfigSingle
  level: DialogueLevel
  projectId: string
  chapter: Chapter | null
  allChapters: Chapter[]
  allVolumes: Volume[]
  aiConfig?: Partial<BookAIConfig>
  refreshCache?: boolean
  mainWindow?: BrowserWindow
  reasoningContext?: string
  dialogueMessages?: ConversationMessage[]
  executedReasoningChains?: Set<string>
  messageChainIds?: string[]
  volume?: Volume | null
  contextConfig?: ContextConfig
}

export async function executeTool(
  toolName: string,
  args: Record<string, string>,
  params: ExecuteToolParams
): Promise<string> {
  const { config, level, projectId, chapter: currentChapter, allChapters, mainWindow } = params

  const targetChapter = args.chapterId
    ? allChapters.find(c => c.id === args.chapterId)
    : currentChapter

  // Execute reasoning chains before tool execution
  const REASONING_TOOLS = ['write_chapter_content', 'write_chapter_outline', 'write_volume_outline', 'write_outline']
  let reasoningResults = ''
  if (REASONING_TOOLS.includes(toolName) && mainWindow) {
    if (!params.executedReasoningChains) {
      params.executedReasoningChains = new Set()
    }

    const chainsToExecute: ReasoningChain[] = []

    const projects = getProjects()
    const project = projects.find(p => p.id === projectId)
    const binding = project?.reasoningConfig?.toolChainBindings?.[toolName]
    if (binding) {
      const chain = findReasoningChain(binding)
      if (chain && !params.executedReasoningChains.has(chain.id)) {
        chainsToExecute.push(chain)
      }
    }

    if (chainsToExecute.length > 0) {
      const { executeReasoningChain, buildReasoningContext } = await import('../dialogue')

      for (const chain of chainsToExecute) {
        params.executedReasoningChains.add(chain.id)

        const ctxConfig = chain.contextConfig || DEFAULT_REASONING_CONTEXT_CONFIG
        const contextParts: string[] = []

        if (targetChapter) {
          contextParts.push(`当前章节：${targetChapter.title}`)
        }

        if (ctxConfig.bookOutline) {
          const bookOutline = getOutline('book', projectId)
          if (bookOutline?.content) {
            contextParts.push(`## 书籍大纲\n${bookOutline.content.substring(0, 2000)}`)
          }
        }

        if (ctxConfig.volumeOutline) {
          const volumeId = targetChapter?.volumeId || params.chapter?.volumeId
          if (volumeId) {
            const volOutline = getOutline('volume', volumeId)
            if (volOutline?.content) {
              contextParts.push(`## 卷大纲\n${volOutline.content.substring(0, 2000)}`)
            }
          }
        }

        if (ctxConfig.chapterOutline && targetChapter) {
          const chOutline = getOutline('chapter', targetChapter.id)
          if (chOutline?.content) {
            contextParts.push(`## 章节大纲\n${chOutline.content.substring(0, 1000)}`)
          }
        }

        if (ctxConfig.previousSummaries && targetChapter) {
          const volChapters = allChapters
            .filter(c => c.volumeId === targetChapter.volumeId)
            .sort((a, b) => a.orderIndex - b.orderIndex)
          const currentIdx = volChapters.findIndex(c => c.id === targetChapter.id)
          const prevChapters = volChapters.slice(Math.max(0, currentIdx - 3), currentIdx)
          if (prevChapters.length > 0) {
            const summaries = prevChapters
              .filter(c => c.summaryResult)
              .map(c => `- ${c.title}：${c.summaryResult?.substring(0, 200)}`)
            if (summaries.length > 0) {
              contextParts.push(`## 前文摘要\n${summaries.join('\n')}`)
            }
          }
        }

        if (ctxConfig.dialogueHistory && params.dialogueMessages?.length) {
          const recentMessages = params.dialogueMessages.slice(-6)
          const dialogueText = recentMessages
            .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content.substring(0, 200)}`)
            .join('\n')
          contextParts.push(`## 最近对话\n${dialogueText}`)
        }

        const context = contextParts.join('\n\n')

        const session = await executeReasoningChain(chain, context, config, mainWindow)
        const reasoningResult = buildReasoningContext(session, true)
        if (reasoningResult) {
          reasoningResults += reasoningResult
        }
      }

      if (params.messageChainIds) {
        params.messageChainIds = []
      }
    }
  }

  const rawResult = await executeToolInternal(toolName, args, params, targetChapter, reasoningResults)
  return rawResult
}

async function executeToolInternal(
  toolName: string,
  args: Record<string, string>,
  params: ExecuteToolParams,
  targetChapter: Chapter | undefined | null,
  reasoningResults: string
): Promise<string> {
  const { projectId, allChapters, allVolumes } = params

  // Try each handler in order
  const handlerParams = { ...params, allVolumes }

  const chapterResult = await handleChapterTools(toolName, args, handlerParams, targetChapter, reasoningResults)
  if (chapterResult) return chapterResult

  const outlineResult = await handleOutlineTools(toolName, args, { projectId }, targetChapter, reasoningResults)
  if (outlineResult) return outlineResult

  const skillResult = await handleSkillTools(toolName, args, projectId)
  if (skillResult) return skillResult

  const reasoningResult = await handleReasoningTools(toolName, args, projectId)
  if (reasoningResult) return reasoningResult

  const searchResult = await handleSearchTools(toolName, args)
  if (searchResult) return searchResult

  // Handle remaining tools that don't fit into categories
  switch (toolName) {
    case 'create_chapter': {
      if (!args.title) return '错误：未提供章节标题'
      const newChapter = createChapter(projectId, args.title, args.volumeId || null)
      if (!newChapter) return `错误：章节名「${args.title}」在该卷下已存在`
      params.allChapters.push(newChapter)
      return `已创建章节「${newChapter.title}」（ID: ${newChapter.id}）`
    }

    case 'create_volume': {
      if (!args.name) return '错误：未提供卷名称'
      const newVolume = createVolume(projectId, args.name)
      params.allVolumes.push(newVolume)
      return `已创建卷「${newVolume.name}」（ID: ${newVolume.id}）`
    }

    case 'rename_chapter': {
      if (!args.chapterId) return '错误：未提供章节 ID'
      if (!args.newTitle) return '错误：未提供新标题'
      renameChapter(args.chapterId, args.newTitle)
      return `已将章节重命名为「${args.newTitle}」`
    }

    default:
      return `错误：未知工具 ${toolName}`
  }
}
