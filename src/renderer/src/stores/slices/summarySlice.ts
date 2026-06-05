import type { StateCreator } from 'zustand'
import type { ChapterSlice } from './chapterSlice'
import type { ProjectSlice } from './projectSlice'
import type { UISlice } from './uiSlice'

export interface SummarySlice {
  // State
  isSummarizing: boolean
  summaryResult: string | null
  summaryError: string | null
  isRefining: boolean
  refineProgress: { current: number; total: number } | null

  // Actions
  summarizeChapter: () => Promise<void>
  regenerateSummary: () => Promise<void>
  refineSummary: () => Promise<void>
  refineVolumeSummaries: () => Promise<void>
}

export const createSummarySlice: StateCreator<
  SummarySlice & ChapterSlice & ProjectSlice & UISlice,
  [],
  [],
  SummarySlice
> = (set, get) => ({
  isSummarizing: false,
  summaryResult: null,
  summaryError: null,
  isRefining: false,
  refineProgress: null,

  summarizeChapter: async () => {
    const { summaryResult } = get()
    if (summaryResult) {
      set({ rightPanel: 'summary' } as any)
      return
    }
    set({ rightPanel: 'summary' } as any)
    await get().regenerateSummary()
  },

  regenerateSummary: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    const state = get()
    const mergedAI = (state as any).currentProject?.aiConfig

    set({
      isSummarizing: true,
      summaryError: null,
      summaryResult: null,
      aiIsThinking: false,
      aiThinkingText: ''
    } as any)
    const unsubChunk = window.api.onAIThinkingChunk((data) => {
      set(s => ({ aiIsThinking: true, aiThinkingText: (s as any).aiThinkingText + data.chunk }) as any)
    })
    const unsubDone = window.api.onAIThinkingDone(() => {
      set({ aiIsThinking: false } as any)
    })
    try {
      const result = await window.api.summarizeChapter(currentChapter.content, mergedAI)
      set({ summaryResult: result, isSummarizing: false })
      await window.api.updateChapterSummary(currentChapter.id, result)
    } catch (e: any) {
      set({ summaryError: e.message, isSummarizing: false })
    } finally {
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' } as any)
    }
  },

  refineSummary: async () => {
    const { currentChapter } = get()
    if (!currentChapter || !currentChapter.content.trim()) return

    const state = get()
    const mergedAI = (state as any).currentProject?.aiConfig

    set({
      isRefining: true,
      refineProgress: null,
      aiIsThinking: false,
      aiThinkingText: ''
    } as any)
    const unsubChunk = window.api.onAIThinkingChunk((data) => {
      set(s => ({ aiIsThinking: true, aiThinkingText: (s as any).aiThinkingText + data.chunk }) as any)
    })
    const unsubDone = window.api.onAIThinkingDone(() => {
      set({ aiIsThinking: false } as any)
    })
    try {
      const result = await window.api.refineSummary(currentChapter.content, mergedAI)
      await window.api.updateChapterSummary(currentChapter.id, result)
      const updated = { ...currentChapter, summaryResult: result }
      set(s => ({
        currentChapter: updated,
        chapters: s.chapters.map(c => c.id === updated.id ? updated : c),
        isRefining: false,
        summaryResult: result,
        rightPanel: 'summary'
      } as any))
    } catch (e: any) {
      set({ isRefining: false })
    } finally {
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' } as any)
    }
  },

  refineVolumeSummaries: async () => {
    const { currentVolumeId, chapters } = get() as any
    if (!currentVolumeId || currentVolumeId === '__unassigned__') return

    const volumeChapters = chapters.filter((c: any) => c.volumeId === currentVolumeId)
    if (volumeChapters.length === 0) return

    const state = get()
    const mergedAI = (state as any).currentProject?.aiConfig

    set({
      isRefining: true,
      refineProgress: { current: 0, total: volumeChapters.length },
      aiIsThinking: false,
      aiThinkingText: ''
    } as any)
    const unsubChunk = window.api.onAIThinkingChunk((data) => {
      set(s => ({ aiIsThinking: true, aiThinkingText: (s as any).aiThinkingText + data.chunk }) as any)
    })
    const unsubDone = window.api.onAIThinkingDone(() => {
      set({ aiIsThinking: false } as any)
    })
    try {
      for (let i = 0; i < volumeChapters.length; i++) {
        const ch = volumeChapters[i]
        if (!ch.content.trim()) continue
        set({ refineProgress: { current: i + 1, total: volumeChapters.length }, aiThinkingText: '' } as any)
        const result = await window.api.refineSummary(ch.content, mergedAI)
        await window.api.updateChapterSummary(ch.id, result)
        set(s => ({
          chapters: s.chapters.map(c => c.id === ch.id ? { ...c, summaryResult: result } : c)
        }))
      }
      set({ isRefining: false, refineProgress: null })
    } catch (e: any) {
      set({ isRefining: false, refineProgress: null })
    } finally {
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' } as any)
    }
  }
})
