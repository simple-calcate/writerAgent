import type { StateCreator } from 'zustand'
import type { Outline, DialogueLevel } from '../../../../shared/types'
import type { UISlice } from './uiSlice'

export interface OutlineSlice {
  // State
  currentOutline: Outline | null
  editingOutlineLevel: DialogueLevel | null
  editingOutlineEntityId: string | null

  // Actions
  openOutline: (level: DialogueLevel, entityId: string) => Promise<void>
  saveOutline: (content: string) => Promise<void>
  closeOutline: () => void
}

export const createOutlineSlice: StateCreator<
  OutlineSlice & UISlice,
  [],
  [],
  OutlineSlice
> = (set, get) => ({
  currentOutline: null,
  editingOutlineLevel: null,
  editingOutlineEntityId: null,

  openOutline: async (level, entityId) => {
    const outline = await window.api.getOutline(level, entityId)
    set({
      currentOutline: outline || null,
      editingOutlineLevel: level,
      editingOutlineEntityId: entityId,
      rightPanel: 'outline'
    } as any)
  },

  saveOutline: async (content) => {
    const { editingOutlineLevel, editingOutlineEntityId, currentOutline } = get()
    if (!editingOutlineLevel || !editingOutlineEntityId) return

    const now = new Date().toISOString()
    const outline: Outline = {
      id: currentOutline?.id || crypto.randomUUID(),
      projectId: editingOutlineLevel === 'book' ? editingOutlineEntityId : null,
      volumeId: editingOutlineLevel === 'volume' ? editingOutlineEntityId : null,
      chapterId: editingOutlineLevel === 'chapter' ? editingOutlineEntityId : null,
      level: editingOutlineLevel,
      content,
      createdAt: currentOutline?.createdAt || now,
      updatedAt: now
    }
    await window.api.saveOutline(outline)
    set({ currentOutline: outline })
  },

  closeOutline: () => {
    set({
      currentOutline: null,
      editingOutlineLevel: null,
      editingOutlineEntityId: null,
      rightPanel: null
    } as any)
  }
})
