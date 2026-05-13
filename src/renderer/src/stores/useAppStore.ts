import { create } from 'zustand'
import type { Project, Chapter, Volume, LLMConfig, PolishResult, PolishMark, VersionSnapshot, ExportOptions, BookAIConfig } from '../../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG } from '../../../shared/types'

type RightPanelType = 'polish' | 'summary' | null
type NavLevel = 'projects' | 'project' | 'volume' | 'chapter' | 'ai-config'

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

  // Export
  exportTxt: () => void
  showExport: boolean
  toggleExport: () => void
  exportProject: (options: ExportOptions) => Promise<boolean>

  // Settings
  showSettings: boolean
  toggleSettings: () => void
  llmConfig: LLMConfig
  loadLLMConfig: () => Promise<void>
  saveLLMConfig: (config: LLMConfig) => Promise<void>

  // UI
  showSidebar: boolean
  toggleSidebar: () => void
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
      rightPanel: null,
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
    if (!currentProject) return
    const chapter = await window.api.createChapter(currentProject.id, title, volumeId)
    set(s => ({ chapters: [...s.chapters, chapter], currentChapter: chapter, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null, summaryResult: null, rightPanel: null, navLevel: 'chapter' as NavLevel }))
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
      set({ currentChapter: null, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null, summaryResult: null, rightPanel: null })
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

  // Settings
  showSettings: false,
  toggleSettings: () => set(s => ({ showSettings: !s.showSettings })),

  llmConfig: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', aiFeatures: { polish: true, summary: true } },

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
  toggleSidebar: () => set(s => ({ showSidebar: !s.showSidebar }))
}))
