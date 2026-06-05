import type { StateCreator } from 'zustand'
import type { LLMConfig, BookAIConfig, ProjectReasoningConfig } from '../../../../shared/types'
import { DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG } from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'
import type { ChapterSlice } from './chapterSlice'

type RightPanelType = 'polish' | 'summary' | 'dialogue' | 'outline' | null
type NavLevel = 'projects' | 'project' | 'volume' | 'chapter' | 'ai-config' | 'outline'

export interface UISlice {
  // Right Panel
  rightPanel: RightPanelType
  setRightPanel: (panel: RightPanelType) => void

  // Sidebar navigation
  navLevel: NavLevel
  currentVolumeId: string | null
  navTo: (level: NavLevel, volumeId?: string | null) => void
  navBack: () => void

  // AI Config editing
  editingAIConfig: 'book' | null
  editingVolumeId: string | null
  setEditingAIConfig: (level: 'book' | null, volumeId?: string | null) => void
  saveBookAIConfig: (config: Partial<BookAIConfig>) => Promise<void>
  saveVolumeAIConfig: (volumeId: string, config: Partial<BookAIConfig>) => Promise<void>
  updateProjectReasoningConfig: (config: ProjectReasoningConfig) => Promise<void>

  // Settings
  showSettings: boolean
  toggleSettings: () => void
  llmConfig: LLMConfig
  loadLLMConfig: () => Promise<void>
  saveLLMConfig: (config: LLMConfig) => Promise<void>

  // UI
  showSidebar: boolean
  toggleSidebar: () => void

  // Export
  showExport: boolean
  toggleExport: () => void
  exportTxt: () => void
  exportProject: (options: any) => Promise<boolean>
}

export const createUISlice: StateCreator<
  UISlice & ProjectSlice & ChapterSlice,
  [],
  [],
  UISlice
> = (set, get) => ({
  // Right Panel
  rightPanel: null,
  setRightPanel: (panel) => set({ rightPanel: panel }),

  // Sidebar navigation
  navLevel: 'projects' as NavLevel,
  currentVolumeId: null,

  navTo: (level, volumeId) => set({
    navLevel: level,
    currentVolumeId: volumeId || null
  }),

  navBack: () => {
    const { navLevel, editingAIConfig, currentChapter, currentVolumeId } = get()
    if (navLevel === 'ai-config') {
      if (editingAIConfig === 'volume' && currentVolumeId) {
        set({ navLevel: 'volume' as NavLevel, editingAIConfig: null, editingVolumeId: null })
      } else {
        set({ navLevel: 'project' as NavLevel, editingAIConfig: null, editingVolumeId: null })
      }
    } else if (navLevel === 'chapter') {
      if (currentChapter?.volumeId) {
        set({ navLevel: 'volume' as NavLevel, currentVolumeId: currentChapter.volumeId })
      } else {
        set({ navLevel: 'project' as NavLevel })
      }
    } else if (navLevel === 'volume') {
      set({ navLevel: 'project' as NavLevel, currentVolumeId: null })
    } else if (navLevel === 'project') {
      set({ navLevel: 'projects' as NavLevel, currentProject: null, currentChapter: null, currentVolumeId: null } as any)
    }
  },

  // AI Config editing
  editingAIConfig: null,
  editingVolumeId: null,
  setEditingAIConfig: (level, volumeId) => set({
    editingAIConfig: level,
    editingVolumeId: volumeId || null,
    navLevel: level ? 'ai-config' as NavLevel : 'project' as NavLevel
  }),

  saveBookAIConfig: async (config) => {
    const { currentProject } = get()
    if (!currentProject) return
    await window.api.updateProjectAIConfig(currentProject.id, config)
    set(s => ({
      currentProject: s.currentProject ? {
        ...s.currentProject,
        aiConfig: { ...s.currentProject.aiConfig, ...config },
        genre: config.genre !== undefined ? config.genre : s.currentProject.genre
      } : null,
      projects: s.projects.map(p => p.id === currentProject.id ? { ...p, aiConfig: { ...p.aiConfig, ...config } } : p)
    }))
  },

  saveVolumeAIConfig: async (volumeId, config) => {
    const { volumes } = get()
    const volume = volumes.find(v => v.id === volumeId)
    if (!volume) return
    const newConfig = { ...volume.aiConfig, ...config }
    await window.api.updateVolume(volumeId, { aiConfig: newConfig })
    set(s => ({ volumes: s.volumes.map(v => v.id === volumeId ? { ...v, aiConfig: newConfig } : v) }))
  },

  updateProjectReasoningConfig: async (config) => {
    const { currentProject } = get()
    if (!currentProject) return
    await window.api.updateProjectReasoningConfig(currentProject.id, config)
    set(s => ({
      currentProject: s.currentProject ? { ...s.currentProject, reasoningConfig: config } : null,
      projects: s.projects.map(p => p.id === currentProject.id ? { ...p, reasoningConfig: config } : p)
    }))
  },

  // Settings
  showSettings: false,
  toggleSettings: () => set(s => ({ showSettings: !s.showSettings })),

  llmConfig: {
    profiles: [],
    defaultProfileId: null,
    aiFeatures: {
      polish: { enabled: true, profileId: null },
      summary: { enabled: true, profileId: null },
      dialogue: { enabled: true, profileId: null },
      refineSummary: { enabled: true, profileId: null }
    },
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    continuationConfig: { ...DEFAULT_CONTINUATION_CONFIG }
  },

  loadLLMConfig: async () => {
    const config = await window.api.getLLMConfig()
    set({ llmConfig: config })
  },

  saveLLMConfig: async (config) => {
    await window.api.saveLLMConfig(config)
    set({ llmConfig: config, showSettings: false })
  },

  // UI
  showSidebar: true,
  toggleSidebar: () => set(s => ({ showSidebar: !s.showSidebar })),

  // Export
  showExport: false,
  toggleExport: () => set(s => ({ showExport: !s.showExport })),

  exportTxt: () => {
    const { currentChapter } = get()
    if (!currentChapter) return
    const filtered = currentChapter.content
      .split('\n')
      .filter(line => !line.trimStart().startsWith('//'))
      .join('\n')
    const blob = new Blob([filtered], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentChapter.title || '章节'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  },

  exportProject: async (options) => {
    return window.api.exportFiles(options)
  }
})
