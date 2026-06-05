import type { StateCreator } from 'zustand'
import type { Project, Volume } from '../../../../shared/types'
import type { ChapterSlice } from './chapterSlice'
import type { UISlice } from './uiSlice'

export interface ProjectSlice {
  // State
  projects: Project[]
  currentProject: Project | null
  volumes: Volume[]

  // Actions
  loadProjects: () => Promise<void>
  selectProject: (project: Project) => Promise<void>
  createProject: (name: string, genre?: string | null) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  loadVolumes: (projectId: string) => Promise<void>
  createVolume: (name: string) => Promise<void>
  renameVolume: (id: string, name: string) => Promise<void>
  deleteVolume: (id: string) => Promise<void>
}

export const createProjectSlice: StateCreator<
  ProjectSlice & ChapterSlice & UISlice,
  [],
  [],
  ProjectSlice
> = (set, get) => ({
  projects: [],
  currentProject: null,
  volumes: [],

  loadProjects: async () => {
    const projects = await window.api.getProjects()
    set({ projects })
  },

  selectProject: async (project) => {
    set({
      currentProject: project,
      currentChapter: null,
      versions: [],
      undoStack: [],
      polishSuggestions: [],
      activeSuggestionId: null,
      previewOriginalContent: null,
      summaryResult: null,
      summaryError: null,
      navLevel: 'project',
      currentVolumeId: null,
      editingAIConfig: null,
      editingVolumeId: null
    } as any)
    await get().loadVolumes(project.id)
    await get().loadChapters(project.id)
  },

  createProject: async (name, genre) => {
    const project = await window.api.createProject(name, genre)
    set(s => ({
      projects: [project, ...s.projects],
      currentProject: project,
      currentChapter: null,
      versions: [],
      undoStack: [],
      navLevel: 'project'
    } as any))
    await get().loadVolumes(project.id)
    await get().loadChapters(project.id)
  },

  renameProject: async (id, name) => {
    await window.api.renameProject(id, name)
    set(s => ({
      projects: s.projects.map(p => p.id === id ? { ...p, name } : p),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, name } : s.currentProject
    }))
  },

  deleteProject: async (id) => {
    await window.api.deleteProject(id)
    const { currentProject } = get()
    if (currentProject?.id === id) {
      set({ currentProject: null, chapters: [], volumes: [], currentChapter: null } as any)
    }
    await get().loadProjects()
  },

  loadVolumes: async (projectId) => {
    const volumes = await window.api.getVolumes(projectId)
    set({ volumes })
  },

  createVolume: async (name) => {
    const { currentProject } = get()
    if (!currentProject) return
    const volume = await window.api.createVolume(currentProject.id, name)
    set(s => ({ volumes: [...s.volumes, volume] }))
  },

  renameVolume: async (id, name) => {
    await window.api.renameVolume(id, name)
    set(s => ({ volumes: s.volumes.map(v => v.id === id ? { ...v, name } : v) }))
  },

  deleteVolume: async (id) => {
    await window.api.deleteVolume(id)
    set(s => ({
      volumes: s.volumes.filter(v => v.id !== id),
      chapters: s.chapters.map((c: any) => c.volumeId === id ? { ...c, volumeId: null } : c)
    } as any))
  }
})
