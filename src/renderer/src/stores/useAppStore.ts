import { create } from 'zustand'
import type { Project, Chapter, LLMConfig, PolishResult, PolishMark, VersionSnapshot } from '../../../shared/types'

interface AppState {
  // Projects
  projects: Project[]
  currentProject: Project | null
  loadProjects: () => Promise<void>
  selectProject: (project: Project) => Promise<void>
  createProject: (name: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Chapters
  chapters: Chapter[]
  currentChapter: Chapter | null
  loadChapters: (projectId: string) => Promise<void>
  selectChapter: (chapter: Chapter) => Promise<void>
  createChapter: (title: string) => Promise<void>
  renameChapter: (id: string, title: string) => Promise<void>
  updateChapterContent: (content: string) => void
  saveChapter: () => Promise<void>
  deleteChapter: (id: string) => Promise<void>

  // Undo
  undoStack: { content: string; polishingMarks: PolishMark[] }[]
  pushUndo: () => void
  undo: () => void

  // Version History (persisted via IPC)
  versions: VersionSnapshot[]
  showHistory: boolean
  toggleHistory: () => void
  createVersion: () => Promise<void>
  loadVersions: (chapterId: string) => Promise<void>

  // Auto Polish
  isAnalyzing: boolean
  polishSuggestions: PolishResult[]
  analyzeError: string | null
  autoAnalyze: () => Promise<void>
  acceptSuggestion: (id: string) => void
  dismissSuggestion: (id: string) => void
  acceptAllSuggestions: () => void
  dismissAllSuggestions: () => void
  activeSuggestionId: string | null
  previewOriginalContent: string | null
  setActiveSuggestion: (id: string | null) => void

  // Export
  exportTxt: () => void

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

export const useAppStore = create<AppState>((set, get) => ({
  // Projects
  projects: [],
  currentProject: null,

  loadProjects: async () => {
    const projects = await window.api.getProjects()
    set({ projects })
  },

  selectProject: async (project) => {
    set({ currentProject: project, currentChapter: null, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null })
    await get().loadChapters(project.id)
  },

  createProject: async (name) => {
    const project = await window.api.createProject(name)
    set(s => ({ projects: [project, ...s.projects], currentProject: project, currentChapter: null, versions: [], undoStack: [] }))
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
      set({ currentProject: null, chapters: [], currentChapter: null })
    }
    await get().loadProjects()
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
      versions: []
    })
    // Load persisted versions
    const versions = await window.api.getVersions(chapter.id)
    set({ versions })
  },

  createChapter: async (title) => {
    const { currentProject } = get()
    if (!currentProject) return
    const chapter = await window.api.createChapter(currentProject.id, title)
    set(s => ({ chapters: [...s.chapters, chapter], currentChapter: chapter, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null }))
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
      set({ currentChapter: null, versions: [], undoStack: [], polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null })
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

  // Version History (persisted)
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

  // Auto Polish
  isAnalyzing: false,
  polishSuggestions: [],
  analyzeError: null,
  activeSuggestionId: null,
  previewOriginalContent: null,

  autoAnalyze: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    set({ isAnalyzing: true, analyzeError: null, polishSuggestions: [], activeSuggestionId: null, previewOriginalContent: null })
    try {
      const result = await window.api.autoPolish(currentChapter.content)
      set({ polishSuggestions: result.suggestions, isAnalyzing: false })
    } catch (e: any) {
      set({ analyzeError: e.message, isAnalyzing: false })
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
          previewOriginalContent: null
        })
      } else {
        set({ activeSuggestionId: null })
      }
      return
    }

    const suggestion = polishSuggestions.find(s => s.id === id)
    if (!suggestion) return

    const original = previewOriginalContent ?? currentChapter.content
    let baseContent = currentChapter.content
    if (previewOriginalContent !== null) {
      baseContent = previewOriginalContent
    }
    const newContent = baseContent.replace(suggestion.original, suggestion.polished)

    get().pushUndo()
    set({
      currentChapter: { ...currentChapter, content: newContent },
      activeSuggestionId: id,
      previewOriginalContent: original
    })
  },

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

  // Settings
  showSettings: false,
  toggleSettings: () => set(s => ({ showSettings: !s.showSettings })),

  llmConfig: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },

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
