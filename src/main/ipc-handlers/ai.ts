import { BrowserWindow, ipcMain } from 'electron'
import { resolveFeatureConfig, resolveAIConfig, getProjects, getVolumes, getChapters, getConversation, saveConversation, deleteConversation, getOutline, getSkills, getContextConfig } from '../store/db'
import { autoPolish, polishText, summarizeChapter } from '../llm/client'
import { refineSummary } from '../llm/refine-summary'
import { startDialogueStream, cancelDialogueStream, handleApprovalResponse } from '../llm/dialogue'
import { generateContinuation } from '../llm/continuation'
import { compressConversationForStorage, compressConversationMessages } from '../llm/context-compressor'
import { getAgentRuntime } from '../agent/runtime'
import type { BookAIConfig, DialogueLevel, DialogueToolApprovalResponse, Conversation, ConversationMessage, Volume, Chapter, AnalysisResult } from '../../shared/types'

function formatAnalysisForDialogue(result: AnalysisResult): string {
  const { score, summary } = result
  const lines = [
    '## 内容分析报告',
    '',
    `**综合评分：${score.overall}/10**`,
    '',
    '| 维度 | 评分 |',
    '|------|------|',
    `| 结构完整性 | ${score.structure}/10 |`,
    `| 节奏 | ${score.pacing}/10 |`,
    `| 冲突强度 | ${score.conflict}/10 |`,
    `| 信息密度 | ${score.infoDensity}/10 |`,
    `| 文风一致性 | ${score.styleConsistency}/10 |`,
    ''
  ]

  if (score.issues.length > 0) {
    lines.push('### 发现的问题')
    score.issues.forEach(issue => lines.push(`- ${issue}`))
    lines.push('')
  }

  if (score.suggestions.length > 0) {
    lines.push('### 改进建议')
    score.suggestions.forEach(s => lines.push(`- ${s}`))
    lines.push('')
  }

  lines.push(`> ${summary}`)

  return lines.join('\n')
}

export function registerAIHandlers(
  mainWindow: BrowserWindow,
  currentAIAbort: { controller: AbortController | null },
  setCurrentAIAbort: (controller: AbortController | null) => void
): void {
  // AI Cancel
  ipcMain.handle('ai:cancel', () => {
    if (currentAIAbort.controller) {
      currentAIAbort.controller.abort()
      currentAIAbort.controller = null
    }
  })

  // AI
  ipcMain.handle('auto-polish', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('polish')
    console.log('[auto-polish] config:', config ? { model: config.model, baseUrl: config.baseUrl } : null)
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    console.log('[auto-polish] content length:', content.length)
    setCurrentAIAbort(new AbortController())
    try {
      const result = await autoPolish(config, content, aiConfig, mainWindow, currentAIAbort.controller!.signal)
      console.log('[auto-polish] result suggestions:', result.suggestions.length)
      return result
    } finally {
      setCurrentAIAbort(null)
    }
  })

  ipcMain.handle('polish-text', async (_e, original: string, context: string) => {
    const config = resolveFeatureConfig('polish')
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return polishText(config, original, context, mainWindow)
  })

  ipcMain.handle('summarize-chapter', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('summary')
    if (!config) throw new Error('摘要功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    setCurrentAIAbort(new AbortController())
    try {
      return await summarizeChapter(config, content, aiConfig, mainWindow, currentAIAbort.controller!.signal)
    } finally {
      setCurrentAIAbort(null)
    }
  })

  ipcMain.handle('refine-summary', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('refineSummary')
    if (!config) throw new Error('精炼总结功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    setCurrentAIAbort(new AbortController())
    try {
      return await refineSummary(config, content, aiConfig, mainWindow, currentAIAbort.controller!.signal)
    } finally {
      setCurrentAIAbort(null)
    }
  })

  // Continuation
  ipcMain.handle('generate-continuation', async (_e, chapterId: string, cursorPosition: number, content: string) => {
    const config = resolveFeatureConfig('dialogue')
    if (!config || !config.apiKey) return null

    const allProjects = getProjects()
    let chapter = null
    let projectId = ''
    for (const p of allProjects) {
      const chs = getChapters(p.id)
      const found = chs.find(c => c.id === chapterId)
      if (found) { chapter = found; projectId = p.id; break }
    }
    if (!chapter) return null

    const project = allProjects.find(p => p.id === projectId)
    if (!project) return null

    const aiConfig = resolveAIConfig(project)
    const chapterOutline = getOutline('chapter', chapterId)
    const volumeOutline = chapter.volumeId ? getOutline('volume', chapter.volumeId) : null
    const bookOutline = getOutline('book', projectId)

    // 没有任何大纲时不触发续写
    if (!chapterOutline && !volumeOutline && !bookOutline) return null
    const allSkills = getSkills()
    const skillIds = project?.featureSkillIds?.continuation || project?.enabledSkillIds || []
    const enabledSkills = skillIds.length > 0
      ? allSkills.filter(s => skillIds.includes(s.id))
      : []

    return generateContinuation(config, {
      content,
      cursorPosition,
      chapterOutline: chapterOutline?.content,
      volumeOutline: volumeOutline?.content,
      bookOutline: bookOutline?.content,
      aiConfig,
      skills: enabledSkills,
      mainWindow: mainWindow
    })
  })

  // Dialogue
  ipcMain.handle('dialogue:send', async (_e, level: DialogueLevel, entityId: string, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const config = resolveFeatureConfig('dialogue')
    if (!config) throw new Error('对话功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')

    // Resolve context based on level
    const projects = getProjects()
    const project = projects.find(p => {
      if (level === 'book') return p.id === entityId
      if (level === 'volume') {
        const volumes = getVolumes(p.id)
        return volumes.some(v => v.id === entityId)
      }
      const chapters = getChapters(p.id)
      return chapters.some(c => c.id === entityId)
    })
    if (!project) throw new Error('找不到对应的项目')

    const allVolumes = getVolumes(project.id)
    const allChapters = getChapters(project.id)

    let volume: Volume | null = null
    let chapter: Chapter | null = null

    if (level === 'volume') {
      volume = allVolumes.find(v => v.id === entityId) || null
    } else if (level === 'chapter') {
      chapter = allChapters.find(c => c.id === entityId) || null
      if (chapter && chapter.volumeId) {
        volume = allVolumes.find(v => v.id === chapter!.volumeId) || null
      }
    }

    // All input goes through intent classification → router
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    const userContent = lastUserMsg?.content || ''

    const runtime = getAgentRuntime(mainWindow)
    const streamId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    try {
      const { classification, result } = await runtime.route(
        userContent, project, volume, chapter, level, config, undefined, streamId, messages, getContextConfig()
      )

      if (result.pipeline === 'analysis') {
        const analysisMsg = formatAnalysisForDialogue(result.result)
        mainWindow.webContents.send('dialogue:chunk', { streamId, chunk: analysisMsg })
        mainWindow.webContents.send('dialogue:done', { streamId })
        return { streamId }
      }

      // writing or chat pipeline — streamId passed to router, matches frontend's activeStreamId
      return { streamId: result.streamId }
    } catch (err: any) {
      console.error('[Dialogue] Router error, falling back to dialogue stream:', err)
      return startDialogueStream({
        config,
        mainWindow,
        level,
        project,
        volume,
        chapter,
        allVolumes,
        allChapters,
        aiConfig: resolveAIConfig(project),
        messages,
        contextConfig: getContextConfig()
      })
    }
  })

  ipcMain.handle('dialogue:cancel', (_e, streamId: string) => {
    cancelDialogueStream(streamId)
  })

  ipcMain.handle('get-conversation', (_e, level: DialogueLevel, entityId: string) => {
    return getConversation(level, entityId)
  })

  ipcMain.handle('save-conversation', (_e, conversation: Conversation) => {
    const compressed = compressConversationForStorage(conversation)
    saveConversation(compressed)
  })

  ipcMain.handle('delete-conversation', (_e, level: DialogueLevel, entityId: string) => {
    deleteConversation(level, entityId)
  })

  // Dialogue approval
  ipcMain.handle('dialogue:approve-tool', (_e, response: DialogueToolApprovalResponse) => {
    handleApprovalResponse(response)
  })

  // Dialogue context window query
  ipcMain.handle('dialogue:resolve-context-window', () => {
    const config = resolveFeatureConfig('dialogue')
    return config?.contextWindow || null
  })

  // Manual dialogue compression
  ipcMain.handle('dialogue:compress', async (_e, level: DialogueLevel, entityId: string) => {
    const conversation = getConversation(level, entityId)
    if (!conversation || conversation.messages.length === 0) {
      return { compressedCount: 0, summary: '' }
    }

    const config = resolveFeatureConfig('dialogue')
    const contextConfig = getContextConfig()

    let result: { messages: ConversationMessage[]; summary: string; compressedCount: number }

    if (contextConfig?.compressionStrategy === 'semantic') {
      const { compressHistoryWithSummary } = require('../llm/history-compressor')
      const budget = Math.floor((config?.contextWindow || 128000) * 0.25 * (contextConfig.historyBudgetRatio || 0.25))
      const apiMessages = conversation.messages.map(m => ({ role: m.role, content: m.content }))
      const llmResult = await compressHistoryWithSummary(apiMessages, config, budget)

      const keepRecent = contextConfig.keepRecentRounds || 20
      const recentMessages = conversation.messages.slice(-keepRecent)
      const summaryMsg: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: llmResult.summary || '',
        timestamp: new Date().toISOString()
      }

      result = {
        messages: llmResult.summary ? [summaryMsg, ...recentMessages] : conversation.messages,
        summary: llmResult.summary || '',
        compressedCount: llmResult.summary ? conversation.messages.length - recentMessages.length : 0
      }
    } else {
      result = compressConversationMessages(conversation.messages, config?.contextWindow, contextConfig)
    }

    if (result.compressedCount > 0) {
      const updated: Conversation = {
        ...conversation,
        messages: result.messages,
        updatedAt: new Date().toISOString()
      }
      saveConversation(updated)

      // 压缩摘要写入记忆系统
      const { recordMemory } = require('../memory/manager')
      const projects = getProjects()
      const project = projects.find(p => {
        if (level === 'book') return p.id === entityId
        if (level === 'volume') return getVolumes(p.id).some(v => v.id === entityId)
        return getChapters(p.id).some(c => c.id === entityId)
      })
      if (project && result.summary) {
        recordMemory({ type: 'dialogue_compressed', projectId: project.id, level, entityId, summary: result.summary, messageCount: result.compressedCount })
      }
    }

    return { compressedCount: result.compressedCount, summary: result.summary }
  })

  // Memory
  ipcMain.handle('memory:get-context', (_e, projectId: string) => {
    const { getMemoryContext } = require('../memory/manager')
    return getMemoryContext(projectId)
  })

  ipcMain.handle('memory:get-summary', (_e, projectId: string) => {
    const { getMemorySummary } = require('../memory/manager')
    return getMemorySummary(projectId)
  })

  ipcMain.handle('memory:clear', (_e, projectId: string, layer: string) => {
    const { clearMemory } = require('../memory/manager')
    clearMemory(projectId, layer as any)
  })
}
