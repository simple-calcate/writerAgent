import { randomUUID } from 'crypto'
import type { Project, BookAIConfig, FeatureSkillIds, ProjectReasoningConfig } from '../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG } from '../../shared/types'
import { getStore, save } from './db-core'

// ─── AI 配置继承 ───

export function resolveAIConfig(project: Project): BookAIConfig {
  return project.aiConfig || DEFAULT_BOOK_AI_CONFIG
}

// ─── Projects ───

export function getProjects(): Project[] {
  return [...getStore().projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createProject(name: string, genre?: string | null): Project {
  const store = getStore()
  const now = new Date().toISOString()
  const aiConfig: BookAIConfig = { ...DEFAULT_BOOK_AI_CONFIG, genre: genre || null }

  // Default feature skill assignments based on skill categories
  const getSkillIdsByCategories = (categories: string[]) =>
    store.skills.filter(s => categories.includes(s.category)).map(s => s.id)

  const builtinIds = store.skills.filter(s => s.builtin).map(s => s.id)
  const featureSkillIds: FeatureSkillIds = {
    dialogue: [...builtinIds],
    polish: getSkillIdsByCategories(['style', 'formatting']),
    summary: [],
    continuation: getSkillIdsByCategories(['scene', 'dialogue', 'pacing', 'style', 'character', 'structure']),
    outline: [],
    chapterContent: []
  }

  const project: Project = { id: randomUUID(), name, genre: genre || null, aiConfig, featureSkillIds, createdAt: now, updatedAt: now }
  store.projects.push(project)
  save()
  return project
}

export function renameProject(id: string, name: string): void {
  const project = getStore().projects.find(p => p.id === id)
  if (!project) return
  project.name = name
  project.updatedAt = new Date().toISOString()
  save()
}

export function deleteProject(id: string): void {
  const store = getStore()
  const chapterIds = store.chapters.filter(c => c.projectId === id).map(c => c.id)
  for (const cid of chapterIds) {
    delete store.versions[cid]
  }
  store.chapters = store.chapters.filter(c => c.projectId !== id)
  store.volumes = store.volumes.filter(v => v.projectId !== id)
  store.outlines = store.outlines.filter(o => o.projectId !== id)
  store.conversations = store.conversations.filter(c => c.projectId !== id)
  store.projects = store.projects.filter(p => p.id !== id)
  save()
}

export function updateProjectAIConfig(projectId: string, config: Partial<BookAIConfig>): void {
  const project = getStore().projects.find(p => p.id === projectId)
  if (!project) return
  project.aiConfig = { ...project.aiConfig, ...config }
  if (config.genre !== undefined) project.genre = config.genre
  project.updatedAt = new Date().toISOString()
  save()
}

export function updateProjectEnabledSkills(projectId: string, skillIds: string[]): void {
  const project = getStore().projects.find(p => p.id === projectId)
  if (!project) return
  project.enabledSkillIds = skillIds
  project.updatedAt = new Date().toISOString()
  save()
}

export function updateProjectFeatureSkillIds(projectId: string, featureSkillIds: FeatureSkillIds): void {
  const project = getStore().projects.find(p => p.id === projectId)
  if (!project) return
  project.featureSkillIds = featureSkillIds
  project.updatedAt = new Date().toISOString()
  save()
}

export function updateProjectReasoningConfig(projectId: string, config: ProjectReasoningConfig): void {
  const project = getStore().projects.find(p => p.id === projectId)
  if (!project) return
  project.reasoningConfig = config
  project.updatedAt = new Date().toISOString()
  save()
}
