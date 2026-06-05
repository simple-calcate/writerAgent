import type { StateCreator } from 'zustand'
import type { Chapter, PolishMark } from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'
import type { VersionSlice } from './versionSlice'
import type { UISlice } from './uiSlice'

export interface ChapterSlice {
  // State
  chapters: Chapter[]
  currentChapter: Chapter | null
  undoStack: { content: string; polishingMarks: PolishMark[] }[]

  // Actions
  loadChapters: (projectId: string) => Promise<void>
  selectChapter: (chapter: Chapter) => Promise<void>
  createChapter: (title: string, volumeId?: string | null) => Promise<void>
  renameChapter: (id: string, title: string) => Promise<void>
  updateChapterContent: (content: string) => void
  saveChapter: () => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  pushUndo: () => void
  undo: () => void
}

export const createChapterSlice: StateCreator<
  ChapterSlice & ProjectSlice & VersionSlice & UISlice,
  [],
  [],
  ChapterSlice
> = (set, get) => ({
  chapters: [],
  currentChapter: null,
  undoStack: [],

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
      navLevel: 'chapter'
    } as any)
    const versions = await window.api.getVersions(chapter.id)
    set({ versions })
  },

  createChapter: async (title, volumeId) => {
    const { currentProject } = get()
    if (!currentProject) return null
    const chapter = await window.api.createChapter(currentProject.id, title, volumeId)
    if (!chapter) return null
    set(s => ({
      chapters: [...s.chapters, chapter],
      currentChapter: chapter,
      versions: [],
      undoStack: [],
      polishSuggestions: [],
      activeSuggestionId: null,
      previewOriginalContent: null,
      summaryResult: null,
      navLevel: 'chapter'
    } as any))
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
    const { currentChapter, chapters } = get()
    if (!currentChapter) return
    const updated = { ...currentChapter, content }
    set({
      currentChapter: updated,
      chapters: chapters.map(c => c.id === updated.id ? updated : c)
    })
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
      set({
        currentChapter: null,
        versions: [],
        undoStack: [],
        polishSuggestions: [],
        activeSuggestionId: null,
        previewOriginalContent: null,
        summaryResult: null
      } as any)
    }
    const { currentProject } = get()
    if (currentProject) {
      await get().loadChapters(currentProject.id)
    }
  },

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
    const { undoStack, currentChapter, chapters } = get()
    if (undoStack.length === 0 || !currentChapter) return
    const prev = undoStack[undoStack.length - 1]
    const restored = { ...currentChapter, content: prev.content, polishingMarks: prev.polishingMarks }
    set({
      currentChapter: restored,
      chapters: chapters.map(c => c.id === restored.id ? restored : c),
      undoStack: undoStack.slice(0, -1)
    })
  }
})
