import type { StateCreator } from 'zustand'
import { DEFAULT_CONTINUATION_CONFIG } from '../../../../shared/types'
import type { ChapterSlice } from './chapterSlice'
import type { UISlice } from './uiSlice'

export interface ContinuationSlice {
  // State
  continuationSuggestion: string | null
  continuationLoading: boolean
  continuationTimer: ReturnType<typeof setTimeout> | null
  continuationAbortController: AbortController | null
  continuationCursorPos: number | null

  // Actions
  requestContinuation: (cursorPosition: number) => void
  triggerContinuation: (cursorPosition: number) => Promise<void>
  acceptContinuation: () => void
  dismissContinuation: () => void
  clearContinuation: () => void
  resetContinuationTimer: (cursorPosition: number) => void
}

export const createContinuationSlice: StateCreator<
  ContinuationSlice & ChapterSlice & UISlice,
  [],
  [],
  ContinuationSlice
> = (set, get) => ({
  continuationSuggestion: null,
  continuationLoading: false,
  continuationTimer: null,
  continuationAbortController: null,
  continuationCursorPos: null,

  resetContinuationTimer: (cursorPosition) => {
    const { continuationTimer, continuationAbortController } = get()
    if (continuationTimer) clearTimeout(continuationTimer)
    if (continuationAbortController) continuationAbortController.abort()

    const cfg = (get() as any).llmConfig?.continuationConfig || DEFAULT_CONTINUATION_CONFIG
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

    set({
      continuationLoading: true,
      continuationSuggestion: null,
      continuationCursorPos: cursorPosition
    })
    try {
      const result = await window.api.generateContinuation(
        currentChapter.id,
        cursorPosition,
        currentChapter.content
      )
      if (result) {
        set({ continuationSuggestion: result, continuationLoading: false })
      } else {
        set({ continuationLoading: false })
      }
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

    const before = content.substring(0, cursorPos)
    const after = content.substring(cursorPos)
    const needNewlineBefore = before.length > 0 && !before.endsWith('\n\n')
    const needNewlineAfter = after.length > 0 && !after.startsWith('\n\n')
    const prefix = needNewlineBefore ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
    const suffix = needNewlineAfter ? (after.startsWith('\n') ? '\n' : '\n\n') : ''

    const newContent = before + prefix + suggestion + suffix + after
    const insertEnd = cursorPos + prefix.length + suggestion.length

    set({
      continuationSuggestion: null,
      continuationTimer: null,
      continuationCursorPos: null
    })
    state.pushUndo()
    state.updateChapterContent(newContent)

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
    set({
      continuationSuggestion: null,
      continuationTimer: null,
      continuationLoading: false
    })
  },

  clearContinuation: () => {
    set({ continuationSuggestion: null, continuationCursorPos: null })
  }
})
