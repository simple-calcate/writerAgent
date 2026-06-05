import type { StateCreator } from 'zustand'
import type { VersionSnapshot } from '../../../../shared/types'
import type { ChapterSlice } from './chapterSlice'

export interface VersionSlice {
  // State
  versions: VersionSnapshot[]
  showHistory: boolean

  // Actions
  toggleHistory: () => void
  createVersion: () => Promise<void>
  loadVersions: (chapterId: string) => Promise<void>
}

export const createVersionSlice: StateCreator<
  VersionSlice & ChapterSlice,
  [],
  [],
  VersionSlice
> = (set, get) => ({
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
  }
})
