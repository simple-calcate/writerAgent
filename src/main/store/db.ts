import { app, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Project, Chapter, LLMConfig, VersionSnapshot } from '../../shared/types'

interface Store {
  projects: Project[]
  chapters: Chapter[]
  llmConfig: LLMConfig
  versions: Record<string, VersionSnapshot[]>
}

const defaultStore: Store = {
  projects: [],
  chapters: [],
  llmConfig: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  versions: {}
}

// App-level config (data path setting)
interface AppConfig {
  dataPath: string | null // null = use default
}

const appConfigFile = join(app.getPath('userData'), 'app-config.json')

function loadAppConfig(): AppConfig {
  if (existsSync(appConfigFile)) {
    try {
      return JSON.parse(readFileSync(appConfigFile, 'utf-8'))
    } catch { /* ignore */ }
  }
  return { dataPath: null }
}

function saveAppConfig(config: AppConfig): void {
  writeFileSync(appConfigFile, JSON.stringify(config, null, 2), 'utf-8')
}

let store: Store
let currentDataDir: string
let currentDataFile: string

function resolveDataDir(): string {
  const config = loadAppConfig()
  if (config.dataPath && existsSync(config.dataPath)) {
    return config.dataPath
  }
  return join(app.getPath('userData'), 'data')
}

export function getDataPath(): string {
  return currentDataDir
}

export function getDataPathDefault(): string {
  return join(app.getPath('userData'), 'data')
}

export function setDataPath(newPath: string): void {
  // Copy existing data to new location
  if (existsSync(currentDataFile)) {
    if (!existsSync(newPath)) mkdirSync(newPath, { recursive: true })
    const newFile = join(newPath, 'store.json')
    writeFileSync(newFile, readFileSync(currentDataFile, 'utf-8'), 'utf-8')
  }

  // Save the new path in app config
  saveAppConfig({ dataPath: newPath })

  // Update current paths and reload
  currentDataDir = newPath
  currentDataFile = join(newPath, 'store.json')

  if (existsSync(currentDataFile)) {
    try {
      store = { ...defaultStore, ...JSON.parse(readFileSync(currentDataFile, 'utf-8')) }
    } catch {
      store = { ...defaultStore }
    }
  } else {
    store = { ...defaultStore }
    save()
  }
}

export function openDataFolder(): void {
  if (existsSync(currentDataDir)) {
    shell.openPath(currentDataDir)
  }
}

export function initDB(): void {
  currentDataDir = resolveDataDir()
  currentDataFile = join(currentDataDir, 'store.json')

  if (!existsSync(currentDataDir)) mkdirSync(currentDataDir, { recursive: true })
  if (existsSync(currentDataFile)) {
    try {
      store = { ...defaultStore, ...JSON.parse(readFileSync(currentDataFile, 'utf-8')) }
    } catch {
      store = { ...defaultStore }
    }
  } else {
    store = { ...defaultStore }
  }
}

function save(): void {
  writeFileSync(currentDataFile, JSON.stringify(store, null, 2), 'utf-8')
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
  delete store.versions[id]
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

export function deleteVersion(chapterId: string, index: number): void {
  if (!store.versions[chapterId]) return
  store.versions[chapterId].splice(index, 1)
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
