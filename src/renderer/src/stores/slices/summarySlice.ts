import type { StateCreator } from 'zustand'
import { contentHash, getSummaryStatus } from '../../../../shared/utils/contentHash'
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

export interface BatchResult {
  succeeded: number
  failed: number
  skipped: number
  cancelled: boolean
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
  batchResult: BatchResult | null

  // 批量精炼状态
  isBatchRefining: boolean
  batchRefineProgress: BatchProgress | null
  batchRefineError: string | null
  batchRefineResult: BatchResult | null

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

  /** 批量精炼章节总结 */
  refineBatch: (chapterIds: string[], options?: { skipFresh?: boolean }) => Promise<void>
  /** 取消正在进行的批量精炼 */
  cancelBatchRefine: () => Promise<void>
  /** 清除批量精炼结果提示 */
  clearBatchRefineResult: () => void
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

  isBatchRefining: false,
  batchRefineProgress: null,
  batchRefineError: null,
  batchRefineResult: null,

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
  },

  refineBatch: async (chapterIds, options) => {
    if (get().isBatchRefining) return

    const { chapters } = get() as any
    // 预过滤目标章节（保留顺序）
    const skipFresh = options?.skipFresh ?? true
    const targets: { id: string; title: string; content: string }[] = []
    let skipped = 0
    for (const id of chapterIds) {
      const ch = chapters.find((c: any) => c.id === id)
      if (!ch) { skipped++; continue }
      if (!ch.content.trim()) { skipped++; continue }
      if (skipFresh && getSummaryStatus(ch) === 'fresh') { skipped++; continue }
      targets.push({ id: ch.id, title: ch.title, content: ch.content })
    }

    set({
      isBatchRefining: true,
      batchRefineProgress: null,
      batchRefineError: null,
      batchRefineResult: null,
      aiIsThinking: false,
      aiThinkingText: ''
    } as any)

    const unsubChunk = window.api.onAIThinkingChunk((data) => {
      set(s => ({ aiIsThinking: true, aiThinkingText: (s as any).aiThinkingText + data.chunk }) as any)
    })
    const unsubDone = window.api.onAIThinkingDone(() => {
      set({ aiIsThinking: false } as any)
    })

    // 前端取消标志：cancel 时置 true，循环每章开头检查
    let cancelled = false
    // 把 cancel flag 挂到 store 上供 cancelBatchRefine 修改
    ;(get() as any)._batchRefineCancelFlag = () => { cancelled = true }

    const mergedAI = (get() as any).currentProject?.aiConfig

    try {
      // 全部被跳过 → 直接结束
      if (targets.length === 0) {
        set({
          isBatchRefining: false,
          batchRefineProgress: null,
          batchRefineResult: { succeeded: 0, failed: 0, skipped, cancelled: false }
        } as any)
        return
      }

      let succeeded = 0
      let failed = 0
      const failures: { chapterId: string; chapterTitle: string; error: string }[] = []

      for (let i = 0; i < targets.length; i++) {
        if (cancelled) break
        const target = targets[i]

        // 进度更新（开始处理前）
        set({
          batchRefineProgress: {
            batchId: 'refine_batch',
            current: i,
            total: targets.length,
            chapterId: target.id,
            chapterTitle: target.title,
            succeeded,
            failed,
            skipped
          },
          aiThinkingText: ''
        } as any)

        try {
          const result = await window.api.refineSummary(target.content, mergedAI)
          if (cancelled) break
          const hash = contentHash(target.content)
          await window.api.updateChapterSummary(target.id, result, hash)
          // 同步 store 中该章节
          set(s => ({
            chapters: s.chapters.map(c => c.id === target.id ? { ...c, summaryResult: result, summaryOfContentHash: hash } : c)
          } as any))
          succeeded++
        } catch (e) {
          if (cancelled) break
          failed++
          const msg = e instanceof Error ? e.message : String(e)
          failures.push({ chapterId: target.id, chapterTitle: target.title, error: msg })
        }

        // 单章完成后更新进度
        set({
          batchRefineProgress: {
            batchId: 'refine_batch',
            current: i + 1,
            total: targets.length,
            chapterId: target.id,
            chapterTitle: target.title,
            succeeded,
            failed,
            skipped
          }
        } as any)
      }

      set({
        isBatchRefining: false,
        batchRefineProgress: null,
        batchRefineResult: { succeeded, failed, skipped, cancelled }
      } as any)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      set({
        isBatchRefining: false,
        batchRefineProgress: null,
        batchRefineError: msg,
        batchRefineResult: null
      } as any)
    } finally {
      ;(get() as any)._batchRefineCancelFlag = null
      unsubChunk()
      unsubDone()
      set({ aiIsThinking: false, aiThinkingText: '' } as any)
    }
  },

  cancelBatchRefine: async () => {
    // 触发前端取消标志
    const flag = (get() as any)._batchRefineCancelFlag
    if (typeof flag === 'function') flag()
    // 同时中断当前正在进行的单章 refine IPC
    await window.api.aiCancel()
  },

  clearBatchRefineResult: () => {
    set({ batchRefineResult: null, batchRefineError: null } as any)
  }
})
