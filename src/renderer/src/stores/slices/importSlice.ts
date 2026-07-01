import type { StateCreator } from 'zustand'
import type { ImportPreview, ImportConfirmResult } from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'
import type { UISlice } from './uiSlice'

export interface ImportSlice {
  // State
  importPreview: ImportPreview | null
  showImportPreview: boolean
  /** 导入进度（0-100），null 表示未在导入 */
  importProgress: { imported: number; total: number; percent: number } | null

  // Actions
  importBookPreview: () => Promise<ImportPreview | null>
  importBookConfirm: (bookName: string, chapters: { title: string; content: string }[]) => Promise<ImportConfirmResult>
  closeImportPreview: () => void
  setImportProgress: (progress: { imported: number; total: number; percent: number } | null) => void
}

export const createImportSlice: StateCreator<
  ImportSlice & ProjectSlice & UISlice,
  [],
  [],
  ImportSlice
> = (set, get) => ({
  importPreview: null,
  showImportPreview: false,
  importProgress: null,

  importBookPreview: async () => {
    const preview = await window.api.importBookPreview()
    if (preview) {
      set({ importPreview: preview, showImportPreview: true })
    }
    return preview
  },

  importBookConfirm: async (bookName, chapters) => {
    set({ importProgress: { imported: 0, total: chapters.length, percent: 0 } })
    try {
      const result = await window.api.importBookConfirm(bookName, chapters)
      set({ importPreview: null, showImportPreview: false })
      await get().loadProjects()
      set({ currentProject: result.project, navLevel: 'project' } as any)
      await get().loadVolumes(result.project.id)
      await get().loadChapters(result.project.id)
      return result
    } finally {
      set({ importProgress: null })
    }
  },

  closeImportPreview: () => set({ importPreview: null, showImportPreview: false }),

  setImportProgress: (progress) => set({ importProgress: progress })
})
