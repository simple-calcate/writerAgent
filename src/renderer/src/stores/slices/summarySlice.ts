import type { StateCreator } from 'zustand'
import { contentHash } from '../../../../shared/utils/contentHash'
import type { ChapterSlice } from './chapterSlice'
import type { ProjectSlice } from './projectSlice'
import type { UISlice } from './uiSlice'
import type { SummaryBatchProgressEvent, SummaryBatchDoneEvent } from '../../../../shared/types'

export interface BatchProgress {
  batchId: string
  current: number
  total: number
  chapterId: string
  chapterTitle: string
  succeeded: number
  failed: number
  skipped: number
}

export interface SummarySlice {
  // State
  isSummarizing: boolean
  summaryResult: string | null
  summaryError: string | null
  isRefining: boolean
  refineProgress: { current: number; total: number } | null

  // 批量摘要状态
  isBatchSummarizing: boolean
  batchProgress: BatchProgress | null
  batchError: string | null
  /** 上一次批量完成的统计（用于结果提示） */
  batchResult: { succeeded: number; failed: number; skipped: number; cancelled: boolean } | null

  // Actions
  summarizeChapter: () => Promise<void>
  regenerateSummary: () => Promise<void>
  refineSummary: () => Promise<void>
  refineVolumeSummaries: () => Promise<void>

  /** 批量生成章节摘要。chapterIds 为空时使用当前卷所有章节 */
  summarizeBatch: (chapterIds: string[], options?: { skipFresh?: boolean }) => Promise<void>
  /** 取消正在进行的批量摘要 */
  cancelBatchSummarize: () => Promise<void>
  /** 清除批量结果提示 */
  clearBatchResult: () => void
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

  isBatchSummarizing: false,
  batchProgress: null,
  batchError: null,
  batchResult: null,

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
      // 保存摘要时同时记录内容指纹，用于后续判断摘要是否过期
      await window.api.updateChapterSummary(currentChapter.id, result, contentHash(currentChapter.content))
      // 同步更新 store 中的 chapter
      set(s => ({
        chapters: s.chapters.map(c => c.id === currentChapter.id ? { ...c, summaryResult: result, summaryOfContentHash: contentHash(currentChapter.content) } : c)
      } as any))
    } catch (e) {
      set({ summaryError: (e instanceof Error ? e.message : String(e)), isSummarizing: false })
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
      const hash = contentHash(currentChapter.content)
      await window.api.updateChapterSummary(currentChapter.id, result, hash)
      const updated = { ...currentChapter, summaryResult: result, summaryOfContentHash: hash }
      set(s => ({
        currentChapter: updated,
        chapters: s.chapters.map(c => c.id === updated.id ? updated : c),
        isRefining: false,
        summaryResult: result,
        rightPanel: 'summary'
      } as any))
    } catch (e) {
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
        const hash = contentHash(ch.content)
        await window.api.updateChapterSummary(ch.id, result, hash)
        set(s => ({
          chapters: s.chapters.map(c => c.id === ch.id ? { ...c, summaryResult: result, summaryOfContentHash: hash } : c)
        }))
      }
      set({ isRefining: false, refineProgress: null })
    } catch (e) {
      set({ isRefining: false, refineProgress: null })
    } finally {
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' } as any)
    }
  },

  summarizeBatch: async (chapterIds, options) => {
    // 批量任务进行中时不允许重复触发
    if (get().isBatchSummarizing) return

    set({
      isBatchSummarizing: true,
      batchProgress: null,
      batchError: null,
      batchResult: null,
      aiIsThinking: false,
      aiThinkingText: ''
    } as any)

    const unsubProgress = window.api.onSummaryBatchProgress((data: SummaryBatchProgressEvent) => {
      set({
        batchProgress: {
          batchId: data.batchId,
          current: data.current,
          total: data.total,
          chapterId: data.chapterId,
          chapterTitle: data.chapterTitle,
          succeeded: data.succeeded,
          failed: data.failed,
          skipped: data.skipped
        },
        aiThinkingText: ''
      } as any)
    })
    const unsubChunk = window.api.onAIThinkingChunk((data) => {
      set(s => ({ aiIsThinking: true, aiThinkingText: (s as any).aiThinkingText + data.chunk }) as any)
    })
    const unsubDone = window.api.onAIThinkingDone(() => {
      set({ aiIsThinking: false } as any)
    })

    let batchId: string | null = null

    try {
      const mergedAI = (get() as any).currentProject?.aiConfig
      const res = await window.api.summarizeBatch(chapterIds, {
        skipFresh: options?.skipFresh ?? true,
        aiConfig: mergedAI
      })
      batchId = res.batchId

      // 立即把跳过的数量反映到进度上（避免 UI 显示 0/0）
      if (res.total === 0) {
        // 全部被跳过，直接结束
        set({
          isBatchSummarizing: false,
          batchProgress: null,
          batchResult: { succeeded: 0, failed: 0, skipped: res.skipped, cancelled: false }
        } as any)
        return
      }
      set({
        batchProgress: {
          batchId,
          current: 0,
          total: res.total,
          chapterId: '',
          chapterTitle: '',
          succeeded: 0,
          failed: 0,
          skipped: res.skipped
        }
      } as any)

      // 等待 done 事件（IPC 是 fire-and-forget，前端通过事件同步）
      await new Promise<void>((resolve) => {
        const unsubBatchDone = window.api.onSummaryBatchDone((done: SummaryBatchDoneEvent) => {
          if (done.batchId !== batchId) return
          unsubBatchDone()

          // 刷新 store 中已成功生成摘要的章节状态
          // 由于后端已经写入 DB，这里 reload 当前项目的 chapters 即可
          const state = get() as any
          const currentProjectId = state.currentProject?.id
          if (currentProjectId) {
            window.api.getChapters(currentProjectId).then(freshChapters => {
              set({ chapters: freshChapters } as any)
            }).catch(() => {})
          }

          set({
            isBatchSummarizing: false,
            batchProgress: null,
            batchResult: {
              succeeded: done.succeeded,
              failed: done.failed,
              skipped: done.skipped,
              cancelled: done.cancelled
            }
          } as any)
          resolve()
        })
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({
        isBatchSummarizing: false,
        batchProgress: null,
        batchError: msg,
        batchResult: null
      } as any)
    } finally {
      unsubProgress()
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' } as any)
    }
  },

  cancelBatchSummarize: async () => {
    const progress = get().batchProgress
    if (progress?.batchId) {
      await window.api.summarizeBatchCancel(progress.batchId)
    } else {
      // 没有进度时也调用通用 ai:cancel 兜底
      await window.api.aiCancel()
    }
  },

  clearBatchResult: () => {
    set({ batchResult: null, batchError: null } as any)
  }
})
