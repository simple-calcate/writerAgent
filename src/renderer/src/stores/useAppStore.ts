import { create } from 'zustand'
import type { Project, Chapter, Volume, LLMConfig, PolishResult, PolishMark, VersionSnapshot, ExportOptions, BookAIConfig, ConversationMessage, Conversation, DialogueLevel, DialogueStreamChunk, DialogueStreamDone, DialogueStreamError, DialogueToolStart, DialogueToolDone, ToolCallInfo, DialogueToolApproval, DialogueToolApprovalResponse, DialogueThinkingChunk, DialogueThinkingDone, Outline, ImportPreview, ImportConfirmResult } from '../../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG, DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG } from '../../../shared/types'

type RightPanelType = 'polish' | 'summary' | 'dialogue' | 'outline' | null
type NavLevel = 'projects' | 'project' | 'volume' | 'chapter' | 'ai-config' | 'outline'

interface AppState {
  // Projects
  projects: Project[]
  currentProject: Project | null
  loadProjects: () => Promise<void>
  selectProject: (project: Project) => Promise<void>
  createProject: (name: string, genre?: string | null) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Volumes
  volumes: Volume[]
  loadVolumes: (projectId: string) => Promise<void>
  createVolume: (name: string) => Promise<void>
  renameVolume: (id: string, name: string) => Promise<void>
  deleteVolume: (id: string) => Promise<void>

  // Chapters
  chapters: Chapter[]
  currentChapter: Chapter | null
  loadChapters: (projectId: string) => Promise<void>
  selectChapter: (chapter: Chapter) => Promise<void>
  createChapter: (title: string, volumeId?: string | null) => Promise<void>
  renameChapter: (id: string, title: string) => Promise<void>
  updateChapterContent: (content: string) => void
  saveChapter: () => Promise<void>
  deleteChapter: (id: string) => Promise<void>

  // Undo
  undoStack: { content: string; polishingMarks: PolishMark[] }[]
  pushUndo: () => void
  undo: () => void

  // Version History
  versions: VersionSnapshot[]
  showHistory: boolean
  toggleHistory: () => void
  createVersion: () => Promise<void>
  loadVersions: (chapterId: string) => Promise<void>

  // Right Panel
  rightPanel: RightPanelType
  setRightPanel: (panel: RightPanelType) => void

  // Sidebar navigation (drill-down)
  navLevel: NavLevel
  currentVolumeId: string | null
  navTo: (level: NavLevel, volumeId?: string | null) => void
  navBack: () => void

  // AI Config editing
  editingAIConfig: 'book' | 'volume' | null
  editingVolumeId: string | null
  setEditingAIConfig: (level: 'book' | 'volume' | null, volumeId?: string | null) => void
  saveBookAIConfig: (config: Partial<BookAIConfig>) => Promise<void>
  saveVolumeAIConfig: (volumeId: string, config: Partial<BookAIConfig>) => Promise<void>

  // Auto Polish
  isAnalyzing: boolean
  polishSuggestions: PolishResult[]
  analyzeError: string | null
  autoAnalyze: () => Promise<void>
  regeneratePolish: () => Promise<void>
  acceptSuggestion: (id: string) => void
  dismissSuggestion: (id: string) => void
  acceptAllSuggestions: () => void
  dismissAllSuggestions: () => void
  activeSuggestionId: string | null
  previewOriginalContent: string | null
  scrollToPosition: number | null
  setActiveSuggestion: (id: string | null) => void
  clearScrollToPosition: () => void

  // Chapter Summary
  isSummarizing: boolean
  summaryResult: string | null
  summaryError: string | null
  summarizeChapter: () => Promise<void>
  regenerateSummary: () => Promise<void>

  // Refine Summary
  isRefining: boolean
  refineProgress: { current: number; total: number } | null
  refineSummary: () => Promise<void>
  refineVolumeSummaries: () => Promise<void>

  // Export
  exportTxt: () => void
  showExport: boolean
  toggleExport: () => void
  exportProject: (options: ExportOptions) => Promise<boolean>

  // Import
  importPreview: ImportPreview | null
  showImportPreview: boolean
  importBookPreview: () => Promise<ImportPreview | null>
  importBookConfirm: (bookName: string, chapters: { title: string; content: string }[]) => Promise<ImportConfirmResult>
  closeImportPreview: () => void

  // Continuation
  continuationSuggestion: string | null
  continuationLoading: boolean
  continuationTimer: ReturnType<typeof setTimeout> | null
  continuationAbortController: AbortController | null
  continuationCursorPos: number | null
  requestContinuation: (cursorPosition: number) => void
  triggerContinuation: (cursorPosition: number) => Promise<void>
  acceptContinuation: () => void
  dismissContinuation: () => void
  resetContinuationTimer: (cursorPosition: number) => void

  // Settings
  showSettings: boolean
  toggleSettings: () => void
  llmConfig: LLMConfig
  loadLLMConfig: () => Promise<void>
  saveLLMConfig: (config: LLMConfig) => Promise<void>

  // UI
  showSidebar: boolean
  toggleSidebar: () => void

  // Dialogue
  dialogueLevel: DialogueLevel | null
  dialogueEntityId: string | null
  dialogueMessages: ConversationMessage[]
  isStreaming: boolean
  streamingText: string
  activeStreamId: string | null
  dialogueError: string | null
  streamingToolCalls: ToolCallInfo[]
  isThinking: boolean
  thinkingText: string
  planModeActive: boolean
  openDialogue: (level: DialogueLevel) => Promise<void>
  closeDialogue: () => void
  sendDialogueMessage: (content: string) => Promise<void>
  cancelDialogueStream: () => void
  clearDialogue: () => Promise<void>
  _handleStreamChunk: (data: DialogueStreamChunk) => void
  _handleStreamDone: (data: DialogueStreamDone) => void
  _handleStreamError: (data: DialogueStreamError) => void
  _handleToolStart: (data: DialogueToolStart) => void
  _handleToolDone: (data: DialogueToolDone) => void
  _handleToolApproval: (data: DialogueToolApproval) => void
  _handleThinkingChunk: (data: DialogueThinkingChunk) => void
  _handleThinkingDone: (data: DialogueThinkingDone) => void

  // Dialogue approval
  pendingApprovals: DialogueToolApproval[]
  approveTool: (approvalId: string, approved: boolean, refreshCache?: boolean) => void

  // Outlines
  currentOutline: Outline | null
  editingOutlineLevel: DialogueLevel | null
  editingOutlineEntityId: string | null
  openOutline: (level: DialogueLevel, entityId: string) => Promise<void>
  saveOutline: (content: string) => Promise<void>
  closeOutline: () => void
}

// 获取当前章节所属卷的 AI 配置
function getVolumeAIConfig(state: AppState): Partial<BookAIConfig> | undefined {
  const { currentChapter, volumes } = state
  if (!currentChapter?.volumeId) return undefined
  const volume = volumes.find(v => v.id === currentChapter.volumeId)
  return volume?.aiConfig
}

export const useAppStore = create<AppState>((set, get) => ({
  // Projects
  projects: [],
  currentProject: null,

  loadProjects: async () => {
    const projects = await window.api.getProjects()
    set({ projects })
  },

  selectProject: async (project) => {
    set({
      currentProject: project,
      currentChapter: null,
      versions: [],
      undoStack: [],
      polishSuggestions: [],
      activeSuggestionId: null,
      previewOriginalContent: null,
      summaryResult: null,
      summaryError: null,
      navLevel: 'project',
      currentVolumeId: null,
      editingAIConfig: null,
      editingVolumeId: null
    })
    await get().loadVolumes(project.id)
    await get().loadChapters(project.id)
  },

  createProject: async (name, genre) => {
    const project = await window.api.createProject(name, genre)
    set(s => ({ projects: [project, ...s.projects], currentProject: project, currentChapter: null, versions: [], undoStack: [], navLevel: 'project' as NavLevel }))
    await get().loadVolumes(project.id)
    await get().loadChapters(project.id)
  },

  renameProject: async (id, name) => {
    await window.api.renameProject(id, name)
    set(s => ({
      projects: s.projects.map(p => p.id === id ? { ...p, name } : p),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, name } : s.currentProject
    }))
  },

  deleteProject: async (id) => {
    await window.api.deleteProject(id)
    const { currentProject } = get()
    if (currentProject?.id === id) {
      set({ currentProject: null, chapters: [], volumes: [], currentChapter: null })
    }
    await get().loadProjects()
  },

  // Volumes
  volumes: [],

  loadVolumes: async (projectId) => {
    const volumes = await window.api.getVolumes(projectId)
    set({ volumes })
  },

  createVolume: async (name) => {
    const { currentProject } = get()
    if (!currentProject) return
    const volume = await window.api.createVolume(currentProject.id, name)
    set(s => ({ volumes: [...s.volumes, volume] }))
  },

  renameVolume: async (id, name) => {
    await window.api.renameVolume(id, name)
    set(s => ({ volumes: s.volumes.map(v => v.id === id ? { ...v, name } : v) }))
  },

  deleteVolume: async (id) => {
    await window.api.deleteVolume(id)
    // 章节的 volumeId 会被后端清为 null
    set(s => ({
      volumes: s.volumes.filter(v => v.id !== id),
      chapters: s.chapters.map(c => c.volumeId === id ? { ...c, volumeId: null } : c)
    }))
  },

  // Chapters
  chapters: [],
  currentChapter: null,

  loadChapters: async (projectId) => {
    const chapters = await window.api.getChapters(projectId)
    set({ chapters })
  },

  selectChapter: async (chapter) => {
    set({
      currentChapter: chapter,
      polishSuggestions: [],
      activeSuggestionId: null,
      previewOriginalContent: null,
      undoStack: [],
      versions: [],
      summaryResult: chapter.summaryResult || null,
      summaryError: null,
      navLevel: 'chapter' as NavLevel
    })
    const versions = await window.api.getVersions(chapter.id)
    set({ versions })
  },

  createChapter: async (title, volumeId) => {
    const { currentProject } = get()
    if (!currentProject) return null
    const chapter = await window.api.createChapter(currentProject.id, title, volumeId)
    if (!chapter) return null
    set(s => ({ chapters: [...s.chapters, chapter], currentChapter: chapter, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null, summaryResult: null, navLevel: 'chapter' as NavLevel }))
    return chapter
  },

  renameChapter: async (id, title) => {
    await window.api.renameChapter(id, title)
    set(s => ({
      chapters: s.chapters.map(ch => ch.id === id ? { ...ch, title } : ch),
      currentChapter: s.currentChapter?.id === id ? { ...s.currentChapter, title } : s.currentChapter
    }))
  },

  updateChapterContent: (content) => {
    const { currentChapter } = get()
    if (!currentChapter) return
    set({ currentChapter: { ...currentChapter, content } })
  },

  saveChapter: async () => {
    const { currentChapter } = get()
    if (!currentChapter) return
    await window.api.updateChapter(currentChapter.id, {
      content: currentChapter.content,
      polishingMarks: currentChapter.polishingMarks
    })
  },

  deleteChapter: async (id) => {
    await window.api.deleteChapter(id)
    const { currentChapter } = get()
    if (currentChapter?.id === id) {
      set({ currentChapter: null, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null, summaryResult: null })
    }
    const { currentProject } = get()
    if (currentProject) {
      await get().loadChapters(currentProject.id)
    }
  },

  // Undo
  undoStack: [],

  pushUndo: () => {
    const { currentChapter, undoStack } = get()
    if (!currentChapter) return
    const snapshot = {
      content: currentChapter.content,
      polishingMarks: [...(currentChapter.polishingMarks || [])]
    }
    set({ undoStack: [...undoStack.slice(-30), snapshot] })
  },

  undo: () => {
    const { undoStack, currentChapter } = get()
    if (undoStack.length === 0 || !currentChapter) return
    const prev = undoStack[undoStack.length - 1]
    set({
      currentChapter: { ...currentChapter, content: prev.content, polishingMarks: prev.polishingMarks },
      undoStack: undoStack.slice(0, -1)
    })
  },

  // Version History
  versions: [],
  showHistory: false,
  toggleHistory: () => set(s => ({ showHistory: !s.showHistory })),

  loadVersions: async (chapterId) => {
    const versions = await window.api.getVersions(chapterId)
    set({ versions })
  },

  createVersion: async () => {
    const { currentChapter, versions } = get()
    if (!currentChapter) return
    const snap: VersionSnapshot = {
      content: currentChapter.content,
      polishingMarks: [...(currentChapter.polishingMarks || [])],
      timestamp: new Date().toISOString()
    }
    await window.api.saveVersion(currentChapter.id, snap)
    set({ versions: [...versions, snap] })
  },

  // Right Panel
  rightPanel: null,
  setRightPanel: (panel) => set({ rightPanel: panel }),

  // Sidebar navigation
  navLevel: 'projects' as NavLevel,
  currentVolumeId: null,

  navTo: (level, volumeId) => set({
    navLevel: level,
    currentVolumeId: volumeId || null
  }),

  navBack: () => {
    const { navLevel, editingAIConfig, currentChapter, currentVolumeId, volumes } = get()
    if (navLevel === 'ai-config') {
      // Return from AI config to its parent level
      if (editingAIConfig === 'volume' && currentVolumeId) {
        set({ navLevel: 'volume' as NavLevel, editingAIConfig: null, editingVolumeId: null })
      } else {
        set({ navLevel: 'project' as NavLevel, editingAIConfig: null, editingVolumeId: null })
      }
    } else if (navLevel === 'chapter') {
      // Return to volume or project
      if (currentChapter?.volumeId) {
        set({ navLevel: 'volume' as NavLevel, currentVolumeId: currentChapter.volumeId })
      } else {
        set({ navLevel: 'project' as NavLevel })
      }
    } else if (navLevel === 'volume') {
      set({ navLevel: 'project' as NavLevel, currentVolumeId: null })
    } else if (navLevel === 'project') {
      set({ navLevel: 'projects' as NavLevel, currentProject: null, currentChapter: null, currentVolumeId: null })
    }
  },

  // AI Config editing
  editingAIConfig: null,
  editingVolumeId: null,
  setEditingAIConfig: (level, volumeId) => set({
    editingAIConfig: level,
    editingVolumeId: volumeId || null,
    navLevel: level ? 'ai-config' as NavLevel : 'project' as NavLevel
  }),

  saveBookAIConfig: async (config) => {
    const { currentProject } = get()
    if (!currentProject) return
    await window.api.updateProjectAIConfig(currentProject.id, config)
    set(s => ({
      currentProject: s.currentProject ? { ...s.currentProject, aiConfig: { ...s.currentProject.aiConfig, ...config }, genre: config.genre !== undefined ? config.genre : s.currentProject.genre } : null,
      projects: s.projects.map(p => p.id === currentProject.id ? { ...p, aiConfig: { ...p.aiConfig, ...config } } : p)
    }))
  },

  saveVolumeAIConfig: async (volumeId, config) => {
    const { volumes } = get()
    const volume = volumes.find(v => v.id === volumeId)
    if (!volume) return
    const newConfig = { ...volume.aiConfig, ...config }
    await window.api.updateVolume(volumeId, { aiConfig: newConfig })
    set(s => ({ volumes: s.volumes.map(v => v.id === volumeId ? { ...v, aiConfig: newConfig } : v) }))
  },

  // Auto Polish
  isAnalyzing: false,
  polishSuggestions: [],
  analyzeError: null,
  activeSuggestionId: null,
  previewOriginalContent: null,
  scrollToPosition: null,

  autoAnalyze: async () => {
    const { polishSuggestions } = get()
    if (polishSuggestions.length > 0) {
      set({ rightPanel: 'polish' })
      return
    }
    set({ rightPanel: 'polish' })
    await get().regeneratePolish()
  },

  regeneratePolish: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    const state = get()
    const volumeAI = getVolumeAIConfig(state)
    const bookAI = state.currentProject?.aiConfig
    const mergedAI = bookAI ? { ...bookAI, ...volumeAI } : volumeAI

    set({ isAnalyzing: true, analyzeError: null, polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null })
    try {
      const result = await window.api.autoPolish(currentChapter.content, mergedAI)
      set({ polishSuggestions: result.suggestions, isAnalyzing: false })
    } catch (e: any) {
      set({ analyzeError: e.message, isAnalyzing: false })
    }
  },

  // Chapter Summary
  isSummarizing: false,
  summaryResult: null,
  summaryError: null,

  // Refine Summary
  isRefining: false,
  refineProgress: null,

  summarizeChapter: async () => {
    const { summaryResult } = get()
    if (summaryResult) {
      set({ rightPanel: 'summary' })
      return
    }
    set({ rightPanel: 'summary' })
    await get().regenerateSummary()
  },

  regenerateSummary: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    const state = get()
    const volumeAI = getVolumeAIConfig(state)
    const bookAI = state.currentProject?.aiConfig
    const mergedAI = bookAI ? { ...bookAI, ...volumeAI } : volumeAI

    set({ isSummarizing: true, summaryError: null, summaryResult: null })
    try {
      const result = await window.api.summarizeChapter(currentChapter.content, mergedAI)
      set({ summaryResult: result, isSummarizing: false })
      // 持久化摘要结果
      await window.api.updateChapterSummary(currentChapter.id, result)
    } catch (e: any) {
      set({ summaryError: e.message, isSummarizing: false })
    }
  },

  refineSummary: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    const state = get()
    const volumeAI = getVolumeAIConfig(state)
    const bookAI = state.currentProject?.aiConfig
    const mergedAI = bookAI ? { ...bookAI, ...volumeAI } : volumeAI

    set({ isRefining: true, refineProgress: null })
    try {
      const result = await window.api.refineSummary(currentChapter.content, mergedAI)
      await window.api.updateChapterSummary(currentChapter.id, result)
      // Reload chapter to reflect updated summary
      const updated = { ...currentChapter, summaryResult: result }
      set(s => ({
        currentChapter: updated,
        chapters: s.chapters.map(c => c.id === updated.id ? updated : c),
        isRefining: false,
        summaryResult: result,
        rightPanel: 'summary'
      }))
    } catch (e: any) {
      set({ isRefining: false })
    }
  },

  refineVolumeSummaries: async () => {
    const { currentVolumeId, chapters } = get()
    if (!currentVolumeId || currentVolumeId === '__unassigned__') return

    const volumeChapters = chapters.filter(c => c.volumeId === currentVolumeId)
    if (volumeChapters.length === 0) return

    const state = get()
    const volumeAI = getVolumeAIConfig(state)
    const bookAI = state.currentProject?.aiConfig
    const mergedAI = bookAI ? { ...bookAI, ...volumeAI } : volumeAI

    set({ isRefining: true, refineProgress: { current: 0, total: volumeChapters.length } })
    try {
      for (let i = 0; i < volumeChapters.length; i++) {
        const ch = volumeChapters[i]
        if (!ch.content.trim()) continue
        set({ refineProgress: { current: i + 1, total: volumeChapters.length } })
        const result = await window.api.refineSummary(ch.content, mergedAI)
        await window.api.updateChapterSummary(ch.id, result)
        // Update chapter in store
        set(s => ({
          chapters: s.chapters.map(c => c.id === ch.id ? { ...c, summaryResult: result } : c)
        }))
      }
      set({ isRefining: false, refineProgress: null })
    } catch (e: any) {
      set({ isRefining: false, refineProgress: null })
    }
  },

  setActiveSuggestion: (id) => {
    const state = get()
    const { currentChapter, polishSuggestions, previewOriginalContent } = state
    if (!currentChapter) return

    if (id === state.activeSuggestionId) {
      if (previewOriginalContent !== null) {
        get().pushUndo()
        set({
          currentChapter: { ...currentChapter, content: previewOriginalContent },
          activeSuggestionId: null,
          previewOriginalContent: null,
          scrollToPosition: null
        })
      } else {
        set({ activeSuggestionId: null, scrollToPosition: null })
      }
      return
    }

    const suggestion = polishSuggestions.find(s => s.id === id)
    if (!suggestion) return

    const original = previewOriginalContent ?? currentChapter.content
    let baseContent = currentChapter.content
    if (previewOriginalContent !== null) baseContent = previewOriginalContent
    const newContent = baseContent.replace(suggestion.original, suggestion.polished)
    const scrollPos = newContent.indexOf(suggestion.polished)

    get().pushUndo()
    set({
      currentChapter: { ...currentChapter, content: newContent },
      activeSuggestionId: id,
      previewOriginalContent: original,
      scrollToPosition: scrollPos >= 0 ? scrollPos : suggestion.position
    })
  },

  clearScrollToPosition: () => set({ scrollToPosition: null }),

  acceptSuggestion: (id) => {
    const { currentChapter, polishSuggestions } = get()
    if (!currentChapter) return
    const suggestion = polishSuggestions.find(s => s.id === id)
    if (!suggestion) return

    const mark: PolishMark = {
      id: suggestion.id, original: suggestion.original, polished: suggestion.polished,
      reason: suggestion.reason, position: suggestion.position, length: suggestion.polished.length
    }
    const marks = [...(currentChapter.polishingMarks || []), mark]
    set({
      currentChapter: { ...currentChapter, polishingMarks: marks },
      polishSuggestions: polishSuggestions.filter(s => s.id !== id),
      activeSuggestionId: null,
      previewOriginalContent: null
    })
  },

  dismissSuggestion: (id) => {
    const { currentChapter, previewOriginalContent } = get()
    if (previewOriginalContent !== null && currentChapter) {
      get().pushUndo()
      set({
        currentChapter: { ...currentChapter, content: previewOriginalContent },
        polishSuggestions: get().polishSuggestions.filter(s => s.id !== id),
        activeSuggestionId: null,
        previewOriginalContent: null
      })
    } else {
      set(s => ({
        polishSuggestions: s.polishSuggestions.filter(s => s.id !== id),
        activeSuggestionId: null
      }))
    }
  },

  acceptAllSuggestions: async () => {
    const { currentChapter, polishSuggestions, previewOriginalContent } = get()
    if (!currentChapter || polishSuggestions.length === 0) return

    let newContent = previewOriginalContent || currentChapter.content
    const newMarks = [...(currentChapter.polishingMarks || [])]

    const sorted = [...polishSuggestions].sort((a, b) => b.position - a.position)
    for (const s of sorted) {
      newContent = newContent.replace(s.original, s.polished)
      newMarks.push({
        id: s.id, original: s.original, polished: s.polished,
        reason: s.reason, position: s.position, length: s.polished.length
      })
    }

    get().pushUndo()
    set({
      currentChapter: { ...currentChapter, content: newContent, polishingMarks: newMarks },
      polishSuggestions: [],
      activeSuggestionId: null,
      previewOriginalContent: null
    })
  },

  dismissAllSuggestions: () => {
    const { previewOriginalContent, currentChapter } = get()
    if (previewOriginalContent !== null && currentChapter) {
      get().pushUndo()
      set({
        currentChapter: { ...currentChapter, content: previewOriginalContent },
        polishSuggestions: [],
        activeSuggestionId: null,
        previewOriginalContent: null
      })
    } else {
      set({ polishSuggestions: [], activeSuggestionId: null })
    }
  },

  // Export
  exportTxt: () => {
    const { currentChapter } = get()
    if (!currentChapter) return
    const blob = new Blob([currentChapter.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentChapter.title || '章节'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  },

  showExport: false,
  toggleExport: () => set(s => ({ showExport: !s.showExport })),

  exportProject: async (options) => {
    return window.api.exportFiles(options)
  },

  // Import
  importPreview: null,
  showImportPreview: false,

  importBookPreview: async () => {
    const preview = await window.api.importBookPreview()
    if (preview) {
      set({ importPreview: preview, showImportPreview: true })
    }
    return preview
  },

  importBookConfirm: async (bookName, chapters) => {
    const result = await window.api.importBookConfirm(bookName, chapters)
    set({ importPreview: null, showImportPreview: false })
    await get().loadProjects()
    set({ currentProject: result.project, navLevel: 'project' as NavLevel })
    await get().loadVolumes(result.project.id)
    await get().loadChapters(result.project.id)
    return result
  },

  closeImportPreview: () => set({ importPreview: null, showImportPreview: false }),

  // Continuation
  continuationSuggestion: null,
  continuationLoading: false,
  continuationTimer: null,
  continuationAbortController: null,
  continuationCursorPos: null,

  resetContinuationTimer: (cursorPosition) => {
    const { continuationTimer, continuationAbortController } = get()
    if (continuationTimer) clearTimeout(continuationTimer)
    if (continuationAbortController) continuationAbortController.abort()

    const cfg = get().llmConfig.continuationConfig || DEFAULT_CONTINUATION_CONFIG
    const timer = setTimeout(() => {
      get().triggerContinuation(cursorPosition)
    }, cfg.delayMs)
    set({ continuationTimer: timer, continuationAbortController: null })
  },

  requestContinuation: (cursorPosition) => {
    get().resetContinuationTimer(cursorPosition)
  },

  triggerContinuation: async (cursorPosition) => {
    const { currentChapter } = get()
    if (!currentChapter) return

    set({ continuationLoading: true, continuationSuggestion: null, continuationCursorPos: cursorPosition })
    try {
      const result = await window.api.generateContinuation(currentChapter.id, cursorPosition)
      set({ continuationSuggestion: result, continuationLoading: false })
    } catch {
      set({ continuationLoading: false })
    }
  },

  acceptContinuation: () => {
    const state = get()
    const suggestion = state.continuationSuggestion
    const chapter = state.currentChapter
    if (!suggestion || !chapter) return

    const cursorPos = state.continuationCursorPos ?? chapter.content.length
    const content = chapter.content

    // 确保插入位置前后有空行
    const before = content.substring(0, cursorPos)
    const after = content.substring(cursorPos)
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n\n')
    const needNewlineAfter = after.length > 0 && !after.startsWith('\n\n')
    const prefix = needNewlineBefore ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
    const suffix = needNewlineAfter ? (after.startsWith('\n') ? '\n' : '\n\n') : ''

    const newContent = before + prefix + suggestion + suffix + after
    const insertEnd = cursorPos + prefix.length + suggestion.length

    // 先清除建议状态，再更新内容
    set({ continuationSuggestion: null, continuationTimer: null, continuationCursorPos: null })
    state.pushUndo()
    state.updateChapterContent(newContent)

    // 设置光标到插入文本之后
    setTimeout(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.setSelectionRange(insertEnd, insertEnd)
        textarea.focus()
      }
    }, 0)
  },

  dismissContinuation: () => {
    const { continuationTimer } = get()
    if (continuationTimer) clearTimeout(continuationTimer)
    set({ continuationSuggestion: null, continuationTimer: null, continuationLoading: false })
  },

  // Settings
  showSettings: false,
  toggleSettings: () => set(s => ({ showSettings: !s.showSettings })),

  llmConfig: {
    profiles: [{ id: 'default-profile', name: '默认', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }],
    defaultProfileId: 'default-profile',
    aiFeatures: {
      polish: { enabled: true, profileId: null },
      summary: { enabled: true, profileId: null },
      dialogue: { enabled: true, profileId: null },
      refineSummary: { enabled: true, profileId: null }
    },
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    continuationConfig: { ...DEFAULT_CONTINUATION_CONFIG }
  },

  loadLLMConfig: async () => {
    const config = await window.api.getLLMConfig()
    set({ llmConfig: config })
  },

  saveLLMConfig: async (config) => {
    await window.api.saveLLMConfig(config)
    set({ llmConfig: config, showSettings: false })
  },

  // UI
  showSidebar: true,
  toggleSidebar: () => set(s => ({ showSidebar: !s.showSidebar })),

  // Dialogue
  dialogueLevel: null,
  dialogueEntityId: null,
  dialogueMessages: [],
  isStreaming: false,
  streamingText: '',
  activeStreamId: null,
  dialogueError: null,
  streamingToolCalls: [],
  isThinking: false,
  thinkingText: '',
  pendingApprovals: [],
  planModeActive: false,
  _unsubscribeChunk: null as (() => void) | null,
  _unsubscribeDone: null as (() => void) | null,
  _unsubscribeError: null as (() => void) | null,
  _unsubscribeToolStart: null as (() => void) | null,
  _unsubscribeToolDone: null as (() => void) | null,
  _unsubscribeToolApproval: null as (() => void) | null,
  _unsubscribeThinkingChunk: null as (() => void) | null,
  _unsubscribeThinkingDone: null as (() => void) | null,

  openDialogue: async (level) => {
    const state = get()
    // Determine entity ID based on level
    let entityId: string | null = null
    if (level === 'book') {
      entityId = state.currentProject?.id || null
    } else if (level === 'volume') {
      entityId = state.currentVolumeId || null
    } else if (level === 'chapter') {
      entityId = state.currentChapter?.id || null
    }
    if (!entityId) return

    // Clean up previous listeners
    state._unsubscribeChunk?.()
    state._unsubscribeDone?.()
    state._unsubscribeError?.()
    state._unsubscribeToolStart?.()
    state._unsubscribeToolDone?.()
    state._unsubscribeToolApproval?.()
    state._unsubscribeThinkingChunk?.()
    state._unsubscribeThinkingDone?.()

    // Load existing conversation
    const conversation = await window.api.getConversation(level, entityId)

    // Register stream listeners
    const unsubChunk = window.api.onDialogueChunk((data) => get()._handleStreamChunk(data))
    const unsubDone = window.api.onDialogueDone((data) => get()._handleStreamDone(data))
    const unsubError = window.api.onDialogueError((data) => get()._handleStreamError(data))
    const unsubToolStart = window.api.onDialogueToolStart((data) => get()._handleToolStart(data))
    const unsubToolDone = window.api.onDialogueToolDone((data) => get()._handleToolDone(data))
    const unsubToolApproval = window.api.onDialogueToolApproval((data) => get()._handleToolApproval(data))
    const unsubThinkingChunk = window.api.onDialogueThinkingChunk((data) => get()._handleThinkingChunk(data))
    const unsubThinkingDone = window.api.onDialogueThinkingDone((data) => get()._handleThinkingDone(data))

    set({
      dialogueLevel: level,
      dialogueEntityId: entityId,
      dialogueMessages: conversation?.messages || [],
      isStreaming: false,
      streamingText: '',
      activeStreamId: null,
      dialogueError: null,
      streamingToolCalls: [],
      isThinking: false,
      thinkingText: '',
      pendingApprovals: [],
      rightPanel: 'dialogue',
      _unsubscribeChunk: unsubChunk,
      _unsubscribeDone: unsubDone,
      _unsubscribeError: unsubError,
      _unsubscribeToolStart: unsubToolStart,
      _unsubscribeToolDone: unsubToolDone,
      _unsubscribeToolApproval: unsubToolApproval,
      _unsubscribeThinkingChunk: unsubThinkingChunk,
      _unsubscribeThinkingDone: unsubThinkingDone
    })
  },

  closeDialogue: () => {
    const state = get()
    state._unsubscribeChunk?.()
    state._unsubscribeDone?.()
    state._unsubscribeError?.()
    state._unsubscribeToolStart?.()
    state._unsubscribeToolDone?.()
    state._unsubscribeToolApproval?.()
    state._unsubscribeThinkingChunk?.()
    state._unsubscribeThinkingDone?.()
    set({
      dialogueLevel: null,
      dialogueEntityId: null,
      dialogueMessages: [],
      isStreaming: false,
      streamingText: '',
      activeStreamId: null,
      dialogueError: null,
      streamingToolCalls: [],
      isThinking: false,
      thinkingText: '',
      pendingApprovals: [],
      planModeActive: false,
      _unsubscribeChunk: null,
      _unsubscribeDone: null,
      _unsubscribeError: null,
      _unsubscribeToolStart: null,
      _unsubscribeToolDone: null,
      _unsubscribeToolApproval: null,
      _unsubscribeThinkingChunk: null,
      _unsubscribeThinkingDone: null
    })
  },

  sendDialogueMessage: async (content) => {
    const { dialogueLevel, dialogueEntityId, dialogueMessages } = get()
    if (!dialogueLevel || !dialogueEntityId) return

    const PLAN_TRIGGERS = ['规划', '计划', '大纲', '接下来怎么写', '剧情走向', '后续发展', '/plan']
    const isPlanMode = PLAN_TRIGGERS.some(k => content.includes(k))

    const userMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }

    const updatedMessages = [...dialogueMessages, userMsg]
    set({ dialogueMessages: updatedMessages, isStreaming: true, streamingText: '', isThinking: false, thinkingText: '', dialogueError: null, streamingToolCalls: [], pendingApprovals: [], planModeActive: isPlanMode })

    try {
      const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }))
      const { streamId } = await window.api.dialogueSend(dialogueLevel, dialogueEntityId, apiMessages)
      set({ activeStreamId: streamId })
    } catch (err: any) {
      set({ isStreaming: false, dialogueError: err.message })
    }
  },

  cancelDialogueStream: () => {
    const { activeStreamId } = get()
    if (activeStreamId) {
      window.api.dialogueCancel(activeStreamId)
      set({ isStreaming: false, activeStreamId: null })
    }
  },

  clearDialogue: async () => {
    const { dialogueLevel, dialogueEntityId } = get()
    if (dialogueLevel && dialogueEntityId) {
      await window.api.deleteConversation(dialogueLevel, dialogueEntityId)
    }
    set({ dialogueMessages: [], streamingText: '', dialogueError: null })
  },

  _handleStreamChunk: (data) => {
    const { activeStreamId } = get()
    if (data.streamId !== activeStreamId) return
    set(s => ({ streamingText: s.streamingText + data.chunk }))
  },

  _handleToolStart: (data) => {
    const { activeStreamId } = get()
    if (data.streamId !== activeStreamId) return

    const TOOL_DISPLAY: Record<string, string> = {
      summarize_chapter: '章节摘要',
      refine_summary: '精炼总结',
      polish_text: '文本润色',
      create_chapter: '创建章节',
      rename_chapter: '重命名章节',
      write_outline: '撰写书籍大纲',
      write_volume_outline: '撰写卷纲',
      write_chapter_outline: '撰写章纲',
      read_chapter_content: '查看章节内容',
      write_chapter_content: '撰写章节内容'
    }

    const newTool: ToolCallInfo = {
      id: data.toolCallId,
      toolName: data.toolName,
      displayName: TOOL_DISPLAY[data.toolName] || data.toolName,
      args: data.args,
      status: 'running'
    }

    set(s => ({ streamingToolCalls: [...s.streamingToolCalls, newTool] }))
  },

  _handleToolDone: (data) => {
    const { activeStreamId, currentProject } = get()
    if (data.streamId !== activeStreamId) return

    // Find the tool name before updating state
    const toolCall = get().streamingToolCalls.find(tc => tc.id === data.toolCallId)
    const toolName = toolCall?.toolName

    set(s => ({
      streamingToolCalls: s.streamingToolCalls.map(tc =>
        tc.id === data.toolCallId
          ? { ...tc, status: 'done' as const, result: data.result }
          : tc
      )
    }))

    // Reload data if a write tool that affects the sidebar completed successfully
    if (currentProject && data.result && !data.result.startsWith('错误')) {
      if (toolName === 'create_chapter' || toolName === 'rename_chapter' || toolName === 'write_chapter_content') {
        get().loadChapters(currentProject.id)
      }
      if (toolName === 'create_volume' || toolName === 'write_volume_outline') {
        get().loadVolumes(currentProject.id)
      }
      // Reload current outline if an outline tool was used
      if (toolName === 'write_outline' || toolName === 'write_volume_outline' || toolName === 'write_chapter_outline') {
        const { editingOutlineLevel, editingOutlineEntityId, openOutline } = get()
        if (editingOutlineLevel && editingOutlineEntityId) {
          openOutline(editingOutlineLevel, editingOutlineEntityId)
        }
      }
    }
  },

  _handleStreamDone: async (data) => {
    const { activeStreamId, dialogueMessages, dialogueLevel, dialogueEntityId, streamingText, streamingToolCalls, thinkingText } = get()
    if (data.streamId !== activeStreamId) return

    const assistantMsg: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.fullText || streamingText,
      timestamp: new Date().toISOString(),
      toolCalls: streamingToolCalls.length > 0 ? [...streamingToolCalls] : undefined,
      thinkingContent: thinkingText || undefined
    }

    const allMessages = [...dialogueMessages, assistantMsg]

    set({
      dialogueMessages: allMessages,
      isStreaming: false,
      streamingText: '',
      isThinking: false,
      thinkingText: '',
      activeStreamId: null,
      streamingToolCalls: [],
      planModeActive: false
    })

    // Persist conversation
    if (dialogueLevel && dialogueEntityId) {
      const conversation: Conversation = {
        id: `${dialogueLevel}-${dialogueEntityId}`,
        projectId: dialogueLevel === 'book' ? dialogueEntityId : null,
        volumeId: dialogueLevel === 'volume' ? dialogueEntityId : null,
        chapterId: dialogueLevel === 'chapter' ? dialogueEntityId : null,
        level: dialogueLevel,
        messages: allMessages,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await window.api.saveConversation(conversation)
    }
  },

  _handleStreamError: (data) => {
    const { activeStreamId } = get()
    if (data.streamId !== activeStreamId) return
    set({ isStreaming: false, isThinking: false, thinkingText: '', dialogueError: data.error, activeStreamId: null, planModeActive: false })
  },

  _handleThinkingChunk: (data) => {
    const { activeStreamId } = get()
    if (data.streamId !== activeStreamId) return
    set(s => ({
      isThinking: true,
      thinkingText: s.thinkingText + data.chunk
    }))
  },

  _handleThinkingDone: (data) => {
    const { activeStreamId } = get()
    if (data.streamId !== activeStreamId) return
    set({ isThinking: false })
  },

  _handleToolApproval: (data) => {
    set(s => ({ pendingApprovals: [...s.pendingApprovals, data] }))
  },

  approveTool: (approvalId, approved, refreshCache) => {
    window.api.dialogueApproveTool({ approvalId, approved, refreshCache })
    set(s => ({ pendingApprovals: s.pendingApprovals.filter(a => a.approvalId !== approvalId) }))
  },

  // Outlines
  currentOutline: null,
  editingOutlineLevel: null,
  editingOutlineEntityId: null,

  openOutline: async (level, entityId) => {
    const outline = await window.api.getOutline(level, entityId)
    set({
      currentOutline: outline || null,
      editingOutlineLevel: level,
      editingOutlineEntityId: entityId,
      rightPanel: 'outline'
    })
  },

  saveOutline: async (content) => {
    const { editingOutlineLevel, editingOutlineEntityId, currentOutline } = get()
    if (!editingOutlineLevel || !editingOutlineEntityId) return

    const state = get()
    const now = new Date().toISOString()
    const outline: Outline = {
      id: currentOutline?.id || crypto.randomUUID(),
      projectId: editingOutlineLevel === 'book' ? editingOutlineEntityId : null,
      volumeId: editingOutlineLevel === 'volume' ? editingOutlineEntityId : null,
      chapterId: editingOutlineLevel === 'chapter' ? editingOutlineEntityId : null,
      level: editingOutlineLevel,
      content,
      createdAt: currentOutline?.createdAt || now,
      updatedAt: now
    }
    await window.api.saveOutline(outline)
    set({ currentOutline: outline })
  },

  closeOutline: () => {
    set({
      currentOutline: null,
      editingOutlineLevel: null,
      editingOutlineEntityId: null,
      rightPanel: null
    })
  }
}))
