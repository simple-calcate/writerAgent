import type { StateCreator } from 'zustand'
import type { PolishResult, PolishMark } from '../../../../shared/types'
import type { ChapterSlice } from './chapterSlice'
import type { ProjectSlice } from './projectSlice'
import type { UISlice } from './uiSlice'

export interface PolishSlice {
  // State
  isAnalyzing: boolean
  polishSuggestions: PolishResult[]
  analyzeError: string | null
  activeSuggestionId: string | null
  previewOriginalContent: string | null
  scrollToPosition: number | null
  aiIsThinking: boolean
  aiThinkingText: string

  // Actions
  autoAnalyze: () => Promise<void>
  regeneratePolish: () => Promise<void>
  acceptSuggestion: (id: string) => void
  dismissSuggestion: (id: string) => void
  acceptAllSuggestions: () => void
  dismissAllSuggestions: () => void
  setActiveSuggestion: (id: string | null) => void
  clearScrollToPosition: () => void
  cancelAIFeature: () => void
}

export const createPolishSlice: StateCreator<
  PolishSlice & ChapterSlice & ProjectSlice & UISlice,
  [],
  [],
  PolishSlice
> = (set, get) => ({
  isAnalyzing: false,
  polishSuggestions: [],
  analyzeError: null,
  activeSuggestionId: null,
  previewOriginalContent: null,
  scrollToPosition: null,
  aiIsThinking: false,
  aiThinkingText: '',

  cancelAIFeature: () => {
    window.api.aiCancel()
    set({
      aiIsThinking: false,
      aiThinkingText: '',
      isAnalyzing: false,
      isSummarizing: false,
      isRefining: false
    } as any)
  },

  autoAnalyze: async () => {
    const { polishSuggestions } = get()
    if (polishSuggestions.length > 0) {
      set({ rightPanel: 'polish' } as any)
      return
    }
    set({ rightPanel: 'polish' } as any)
    await get().regeneratePolish()
  },

  regeneratePolish: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    const state = get()
    const mergedAI = (state as any).currentProject?.aiConfig

    set({
      isAnalyzing: true,
      analyzeError: null,
      polishSuggestions: [],
      activeSuggestionId: null,
      previewOriginalContent: null,
      aiIsThinking: false,
      aiThinkingText: ''
    })
    const unsubChunk = window.api.onAIThinkingChunk((data) => {
      set(s => ({ aiIsThinking: true, aiThinkingText: s.aiThinkingText + data.chunk }))
    })
    const unsubDone = window.api.onAIThinkingDone(() => {
      set({ aiIsThinking: false })
    })
    try {
      const result = await window.api.autoPolish(currentChapter.content, mergedAI)
      set({ polishSuggestions: result.suggestions, isAnalyzing: false })
    } catch (e: any) {
      set({ analyzeError: e.message, isAnalyzing: false })
    } finally {
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' })
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
    const pos = suggestion.position
    const newContent = baseContent.slice(0, pos) + suggestion.polished + baseContent.slice(pos + suggestion.original.length)
    const scrollPos = pos

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
      id: suggestion.id,
      original: suggestion.original,
      polished: suggestion.polished,
      reason: suggestion.reason,
      position: suggestion.position,
      length: suggestion.polished.length
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
      const pos = s.position
      if (pos >= 0 && pos + s.original.length <= newContent.length) {
        newContent = newContent.slice(0, pos) + s.polished + newContent.slice(pos + s.original.length)
      }
      newMarks.push({
        id: s.id,
        original: s.original,
        polished: s.polished,
        reason: s.reason,
        position: s.position,
        length: s.polished.length
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
  }
})
