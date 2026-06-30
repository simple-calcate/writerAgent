import { BrowserWindow, ipcMain } from 'electron'
import { errorMessage } from '../utils/errors'
import { resolveFeatureConfig, resolveAIConfig, getProjects, getVolumes, getChapters, getConversation, saveConversation, deleteConversation, getOutline, getSkills, getContextConfig, updateChapterSummary } from '../store/db'
import { autoPolish, polishText, summarizeChapter } from '../llm/client'
import { refineSummary } from '../llm/refine-summary'
import { startDialogueStream, cancelDialogueStream, handleApprovalResponse } from '../llm/dialogue'
import { generateContinuation } from '../llm/continuation'
import { compressConversationForStorage, compressConversationMessages } from '../llm/context-compressor'
import { compressHistoryWithSummary } from '../llm/history-compressor'
import { getAgentRuntime } from '../agent/runtime'
import { recordMemory, getMemoryContext, getMemorySummary, clearMemory } from '../memory/manager'
import { log } from '../utils/logger'
import { contentHash, isSummaryStale } from '../../shared/utils/contentHash'
import type { BookAIConfig, DialogueLevel, DialogueToolApprovalResponse, Conversation, ConversationMessage, Volume, Chapter, AnalysisResult, SummaryBatchProgressEvent, SummaryBatchDoneEvent } from '../../shared/types'

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
  // 批量摘要任务的独立取消控制器（不与单章 currentAIAbort 混用，但每章生成时会同步到 currentAIAbort）
  const batchState: { batchId: string | null; controller: AbortController | null } = {
    batchId: null,
    controller: null
  }

  // AI Cancel
  ipcMain.handle('ai:cancel', () => {
    if (currentAIAbort.controller) {
      currentAIAbort.controller.abort()
      currentAIAbort.controller = null
    }
    // 同时取消批量任务
    if (batchState.controller) {
      batchState.controller.abort()
    }
  })

  // AI
  ipcMain.handle('auto-polish', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('polish')
    log.debug('[auto-polish] config:', config ? { model: config.model, baseUrl: config.baseUrl } : null)
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    log.debug('[auto-polish] content length:', content.length)
    setCurrentAIAbort(new AbortController())
    try {
      const result = await autoPolish(config, content, aiConfig, mainWindow, currentAIAbort.controller!.signal)
      log.debug('[auto-polish] result suggestions:', result.suggestions.length)
      return result
    } catch (err) {
      // 确保前端不卡在"思考中"状态
      mainWindow.webContents.send('ai:thinking-done', {})
      log.error('[auto-polish] failed:', err)
      throw err
    } finally {
      setCurrentAIAbort(null)
    }
  })

  ipcMain.handle('polish-text', async (_e, original: string, context: string) => {
    const config = resolveFeatureConfig('polish')
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    try {
      return await polishText(config, original, context, mainWindow)
    } catch (err) {
      mainWindow.webContents.send('ai:thinking-done', {})
      log.error('[polish-text] failed:', err)
      throw err
    }
  })

  ipcMain.handle('summarize-chapter', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('summary')
    if (!config) throw new Error('摘要功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    setCurrentAIAbort(new AbortController())
    try {
      return await summarizeChapter(config, content, aiConfig, mainWindow, currentAIAbort.controller!.signal)
    } catch (err) {
      mainWindow.webContents.send('ai:thinking-done', {})
      log.error('[summarize-chapter] failed:', err)
      throw err
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
    } catch (err) {
      mainWindow.webContents.send('ai:thinking-done', {})
      log.error('[refine-summary] failed:', err)
      throw err
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
    } catch (err) {
      log.error('[Dialogue] Router error, falling back to dialogue stream:', err)
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

    if (contextConfig?.compressionStrategy === 'semantic' && config) {
      const budget = Math.floor((config.contextWindow || 128000) * 0.25 * (contextConfig.historyBudgetRatio || 0.25))
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
    return getMemoryContext(projectId)
  })

  ipcMain.handle('memory:get-summary', (_e, projectId: string) => {
    return getMemorySummary(projectId)
  })

  ipcMain.handle('memory:clear', (_e, projectId: string, layer: string) => {
    clearMemory(projectId, layer as any)
  })

  // ─── 批量摘要生成 ───

  /**
   * 启动批量章节摘要生成。立即返回 batchId，实际生成在后台异步进行，
   * 进度通过 'summary-batch:progress' 事件推送，完成推送 'summary-batch:done'。
   */
  ipcMain.handle('summarize-batch', async (_e, chapterIds: string[], options?: { skipFresh?: boolean; aiConfig?: Partial<BookAIConfig> }) => {
    const config = resolveFeatureConfig('summary')
    if (!config) throw new Error('摘要功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')

    if (!chapterIds || chapterIds.length === 0) {
      throw new Error('未选择任何章节')
    }

    // 同时只允许一个批量任务运行
    if (batchState.controller) {
      throw new Error('已有批量摘要任务进行中，请先停止')
    }

    const skipFresh = options?.skipFresh ?? false

    // 收集章节及其所属项目
    const allProjects = getProjects()
    const targets: { chapter: Chapter; project: { id: string; aiConfig: BookAIConfig } }[] = []
    let skipped = 0

    for (const id of chapterIds) {
      let found: { chapter: Chapter; project: { id: string; aiConfig: BookAIConfig } } | null = null
      for (const p of allProjects) {
        const ch = getChapters(p.id).find(c => c.id === id)
        if (ch) {
          found = { chapter: ch, project: { id: p.id, aiConfig: p.aiConfig } }
          break
        }
      }
      if (!found) { skipped++; continue }

      // 空内容跳过
      if (!found.chapter.content.trim()) { skipped++; continue }
      // 启用"跳过最新"时，摘要仍最新的章节跳过
      if (skipFresh && !isSummaryStale(found.chapter)) { skipped++; continue }

      targets.push(found)
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    batchState.batchId = batchId
    batchState.controller = new AbortController()

    // 异步执行（不阻塞 IPC 返回）
    void runBatchSummarize({
      batchId,
      targets,
      config,
      aiConfigOverride: options?.aiConfig,
      mainWindow,
      batchController: batchState.controller,
      setCurrentAIAbort,
      onProgress: (data: SummaryBatchProgressEvent) => {
        mainWindow.webContents.send('summary-batch:progress', data)
      },
      onDone: (data: SummaryBatchDoneEvent) => {
        mainWindow.webContents.send('summary-batch:done', data)
        if (batchState.batchId === data.batchId) {
          batchState.batchId = null
          batchState.controller = null
        }
      }
    }).catch(err => {
      log.error('[summarize-batch] fatal:', err)
      mainWindow.webContents.send('summary-batch:error', { batchId, error: errorMessage(err) })
      if (batchState.batchId === batchId) {
        batchState.batchId = null
        batchState.controller = null
      }
    })

    return { batchId, total: targets.length, skipped }
  })

  ipcMain.handle('summarize-batch-cancel', (_e, batchId: string) => {
    if (batchState.batchId === batchId && batchState.controller) {
      batchState.controller.abort()
    }
  })
}

/**
 * 批量摘要生成的实际执行器。
 * 串行处理每个章节，每章独立 AbortController（同步到 currentAIAbort 以复用 ai:cancel）。
 * 单章失败不中断整体批次；用户取消立即跳出循环。
 */
async function runBatchSummarize(args: {
  batchId: string
  targets: { chapter: Chapter; project: { id: string; aiConfig: BookAIConfig } }[]
  config: ReturnType<typeof resolveFeatureConfig>
  aiConfigOverride?: Partial<BookAIConfig>
  mainWindow: BrowserWindow
  batchController: AbortController
  setCurrentAIAbort: (controller: AbortController | null) => void
  onProgress: (data: SummaryBatchProgressEvent) => void
  onDone: (data: SummaryBatchDoneEvent) => void
}): Promise<void> {
  const { batchId, targets, config, aiConfigOverride, mainWindow, batchController, setCurrentAIAbort, onProgress, onDone } = args
  if (!config) return

  let succeeded = 0
  let failed = 0
  const failures: { chapterId: string; chapterTitle: string; error: string }[] = []

  for (let i = 0; i < targets.length; i++) {
    // 用户取消 → 立即停止
    if (batchController.signal.aborted) break

    const { chapter, project } = targets[i]
    const mergedAI = aiConfigOverride ?? project.aiConfig

    // 每章独立 controller，同步到 currentAIAbort（这样单章的 ai:cancel 也能中断当前章）
    const chapterController = new AbortController()
    setCurrentAIAbort(chapterController)
    const onBatchAbort = () => chapterController.abort()
    batchController.signal.addEventListener('abort', onBatchAbort, { once: true })

    // 每次进度事件前清空 thinking 状态
    mainWindow.webContents.send('ai:thinking-done', {})

    try {
      const result = await summarizeChapter(config, chapter.content, mergedAI, mainWindow, chapterController.signal)
      // 保存摘要 + 内容指纹（用于后续判断摘要是否过期）
      updateChapterSummary(chapter.id, result, contentHash(chapter.content))
      succeeded++
    } catch (err) {
      if (chapterController.signal.aborted) {
        // 用户取消当前章 → 视为取消整个批次
        break
      }
      failed++
      const msg = errorMessage(err)
      failures.push({ chapterId: chapter.id, chapterTitle: chapter.title, error: msg })
      log.error(`[summarize-batch] chapter ${chapter.title} failed:`, msg)
    } finally {
      batchController.signal.removeEventListener('abort', onBatchAbort)
      setCurrentAIAbort(null)
    }

    onProgress({
      batchId,
      current: i + 1,
      total: targets.length,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      succeeded,
      failed,
      skipped: 0
    })
  }

  // 收尾：发送 thinking-done 确保前端不卡在思考状态
  mainWindow.webContents.send('ai:thinking-done', {})

  onDone({
    batchId,
    total: targets.length,
    succeeded,
    failed,
    skipped: 0,
    cancelled: batchController.signal.aborted,
    failures
  })
}
