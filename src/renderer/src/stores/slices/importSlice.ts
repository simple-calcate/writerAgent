import type { StateCreator } from 'zustand'
import type { ImportPreview, ImportConfirmResult } from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'
import type { UISlice } from './uiSlice'

export interface ImportSlice {
  // State
  importPreview: ImportPreview | null
  showImportPreview: boolean

  // Actions
  importBookPreview: () => Promise<ImportPreview | null>
  importBookConfirm: (bookName: string, chapters: { title: string; content: string }[]) => Promise<ImportConfirmResult>
  closeImportPreview: () => void
}

export const createImportSlice: StateCreator<
  ImportSlice & ProjectSlice & UISlice,
  [],
  [],
  ImportSlice
> = (set, get) => ({
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
    set({ currentProject: result.project, navLevel: 'project' } as any)
    await get().loadVolumes(result.project.id)
    await get().loadChapters(result.project.id)
    return result
  },

  closeImportPreview: () => set({ importPreview: null, showImportPreview: false })
})
