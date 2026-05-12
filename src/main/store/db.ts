import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Project, Chapter, LLMConfig, VersionSnapshot } from '../../shared/types'

interface Store {
  projects: Project[]
  chapters: Chapter[]
  llmConfig: LLMConfig
  versions: Record<string, VersionSnapshot[]> // chapterId -> versions
}

const defaultStore: Store = {
  projects: [],
  chapters: [],
  llmConfig: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  versions: {}
}

let store: Store
const dataDir = join(app.getPath('userData'), 'data')
const dataFile = join(dataDir, 'store.json')

export function initDB(): void {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  if (existsSync(dataFile)) {
    try {
      store = { ...defaultStore, ...JSON.parse(readFileSync(dataFile, 'utf-8')) }
    } catch {
      store = { ...defaultStore }
    }
  } else {
    store = { ...defaultStore }
  }
}

function save(): void {
  writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf-8')
}

// Projects
export function getProjects(): Project[] {
  return [...store.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createProject(name: string): Project {
  const now = new Date().toISOString()
  const project: Project = { id: randomUUID(), name, createdAt: now, updatedAt: now }
  store.projects.push(project)
  save()
  return project
}

export function renameProject(id: string, name: string): void {
  const project = store.projects.find(p => p.id === id)
  if (!project) return
  project.name = name
  project.updatedAt = new Date().toISOString()
  save()
}

export function deleteProject(id: string): void {
  store.chapters = store.chapters.filter(c => c.projectId !== id)
  store.projects = store.projects.filter(p => p.id !== id)
  save()
}

// Chapters
export function getChapters(projectId: string): Chapter[] {
  return store.chapters
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function createChapter(projectId: string, title: string): Chapter {
  const now = new Date().toISOString()
  const maxOrder = store.chapters
    .filter(c => c.projectId === projectId)
    .reduce((max, c) => Math.max(max, c.orderIndex), -1)
  const chapter: Chapter = {
    id: randomUUID(),
    projectId,
    title,
    content: '',
    polishingMarks: [],
    orderIndex: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  }
  store.chapters.push(chapter)
  save()
  return chapter
}

export function renameChapter(id: string, title: string): void {
  const chapter = store.chapters.find(c => c.id === id)
  if (!chapter) return
  chapter.title = title
  chapter.updatedAt = new Date().toISOString()
  save()
}

export function updateChapter(id: string, data: Partial<Chapter>): void {
  const chapter = store.chapters.find(c => c.id === id)
  if (!chapter) return
  if (data.title !== undefined) chapter.title = data.title
  if (data.content !== undefined) chapter.content = data.content
  if (data.polishingMarks !== undefined) chapter.polishingMarks = data.polishingMarks
  chapter.updatedAt = new Date().toISOString()
  save()
}

export function deleteChapter(id: string): void {
  store.chapters = store.chapters.filter(c => c.id !== id)
  save()
}

// Versions
export function getVersions(chapterId: string): VersionSnapshot[] {
  return store.versions[chapterId] || []
}

export function saveVersion(chapterId: string, version: VersionSnapshot): void {
  if (!store.versions[chapterId]) store.versions[chapterId] = []
  store.versions[chapterId].push(version)
  save()
}

// LLM Config
export function getLLMConfig(): LLMConfig {
  return { ...store.llmConfig }
}

export function saveLLMConfig(config: LLMConfig): void {
  store.llmConfig = config
  save()
}
