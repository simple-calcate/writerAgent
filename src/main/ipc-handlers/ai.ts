import { BrowserWindow, ipcMain } from 'electron'
import { resolveFeatureConfig, resolveAIConfig, getProjects, getVolumes, getChapters, getConversation, saveConversation, deleteConversation, getOutline, getSkills, getContextConfig } from '../store/db'
import { autoPolish, polishText, summarizeChapter } from '../llm/client'
import { refineSummary } from '../llm/refine-summary'
import { startDialogueStream, cancelDialogueStream, handleApprovalResponse } from '../llm/dialogue'
import { generateContinuation } from '../llm/continuation'
import { compressConversationForStorage } from '../llm/context-compressor'
import type { BookAIConfig, DialogueLevel, DialogueToolApprovalResponse, Conversation } from '../../shared/types'

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

    let volume = null
    let chapter = null

    if (level === 'volume') {
      volume = allVolumes.find(v => v.id === entityId) || null
    } else if (level === 'chapter') {
      chapter = allChapters.find(c => c.id === entityId) || null
      if (chapter?.volumeId) {
        volume = allVolumes.find(v => v.id === chapter.volumeId) || null
      }
    }

    return startDialogueStream({
      config,
      mainWindow: mainWindow,
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
}
