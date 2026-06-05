import type { StateCreator } from 'zustand'
import type { WritingSkill } from '../../../../shared/types'
import type { ProjectSlice } from './projectSlice'

export interface SkillSlice {
  // State
  skills: WritingSkill[]
  showSkillImportPreview: boolean
  skillImportPreview: WritingSkill[] | null

  // Actions
  loadSkills: () => Promise<void>
  saveSkill: (skill: WritingSkill) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  updateProjectEnabledSkills: (skillIds: string[]) => Promise<void>
  updateProjectFeatureSkillIds: (featureSkillIds: any) => Promise<void>
  exportSkills: (skillIds?: string[]) => Promise<boolean>
  importSkills: () => Promise<WritingSkill[] | null>
  importSkillsConfirm: (skills: WritingSkill[]) => Promise<void>
  closeSkillImportPreview: () => void
}

export const createSkillSlice: StateCreator<
  SkillSlice & ProjectSlice,
  [],
  [],
  SkillSlice
> = (set, get) => ({
  skills: [],
  showSkillImportPreview: false,
  skillImportPreview: null,

  loadSkills: async () => {
    const skills = await window.api.getSkills()
    set({ skills })
  },

  saveSkill: async (skill: WritingSkill) => {
    await window.api.saveSkill(skill)
    const skills = await window.api.getSkills()
    set({ skills })
  },

  deleteSkill: async (id: string) => {
    await window.api.deleteSkill(id)
    const skills = await window.api.getSkills()
    set({ skills })
  },

  updateProjectEnabledSkills: async (skillIds: string[]) => {
    const { currentProject } = get()
    if (!currentProject) return
    await window.api.updateProjectEnabledSkills(currentProject.id, skillIds)
    const projects = await window.api.getProjects()
    const updated = projects.find(p => p.id === currentProject.id)
    if (updated) {
      set({ currentProject: updated, projects })
    }
  },

  updateProjectFeatureSkillIds: async (featureSkillIds: any) => {
    const { currentProject } = get()
    if (!currentProject) return
    await window.api.updateProjectFeatureSkillIds(currentProject.id, featureSkillIds)
    const projects = await window.api.getProjects()
    const updated = projects.find(p => p.id === currentProject.id)
    if (updated) {
      set({ currentProject: updated, projects })
    }
  },

  exportSkills: async (skillIds?: string[]) => {
    return window.api.exportSkills(skillIds)
  },

  importSkills: async () => {
    const skills = await window.api.importSkills()
    if (skills && skills.length > 0) {
      set({ skillImportPreview: skills, showSkillImportPreview: true })
    }
    return skills
  },

  importSkillsConfirm: async (skills: WritingSkill[]) => {
    await window.api.importSkillsConfirm(skills)
    const updatedSkills = await window.api.getSkills()
    set({ skills: updatedSkills, showSkillImportPreview: false, skillImportPreview: null })
  },

  closeSkillImportPreview: () => {
    set({ showSkillImportPreview: false, skillImportPreview: null })
  }
})
