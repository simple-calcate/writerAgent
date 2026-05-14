import { app, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Project, Chapter, Volume, LLMConfig, VersionSnapshot, BookAIConfig, Conversation, DialogueLevel } from '../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG } from '../../shared/types'

interface Store {
  projects: Project[]
  volumes: Volume[]
  chapters: Chapter[]
  llmConfig: LLMConfig
  versions: Record<string, VersionSnapshot[]>
  conversations: Conversation[]
}

const defaultStore: Store = {
  projects: [],
  volumes: [],
  chapters: [],
  llmConfig: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    aiFeatures: { polish: true, summary: true, dialogue: true }
  },
  versions: {},
  conversations: []
}

// App-level config (data path setting)
interface AppConfig {
  dataPath: string | null
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
  if (existsSync(currentDataFile)) {
    if (!existsSync(newPath)) mkdirSync(newPath, { recursive: true })
    const newFile = join(newPath, 'store.json')
    writeFileSync(newFile, readFileSync(currentDataFile, 'utf-8'), 'utf-8')
  }
  saveAppConfig({ dataPath: newPath })
  currentDataDir = newPath
  currentDataFile = join(newPath, 'store.json')
  if (existsSync(currentDataFile)) {
    try {
      const saved = JSON.parse(readFileSync(currentDataFile, 'utf-8'))
      store = migrateStore(saved)
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

// 数据迁移：兼容旧版本数据
function migrateStore(saved: any): Store {
  const migrated = {
    ...defaultStore,
    ...saved,
    llmConfig: { ...defaultStore.llmConfig, ...saved.llmConfig },
    volumes: saved.volumes || [],
    conversations: saved.conversations || []
  }
  // 给旧项目添加 aiConfig
  for (const p of migrated.projects) {
    if (!p.aiConfig) {
      p.aiConfig = { ...DEFAULT_BOOK_AI_CONFIG, genre: p.genre || null }
    }
  }
  // 给旧章节添加 volumeId 和 summaryResult
  for (const ch of migrated.chapters) {
    if (ch.volumeId === undefined) ch.volumeId = null
    if (ch.summaryResult === undefined) ch.summaryResult = null
  }
  return migrated
}

export function initDB(): void {
  currentDataDir = resolveDataDir()
  currentDataFile = join(currentDataDir, 'store.json')
  if (!existsSync(currentDataDir)) mkdirSync(currentDataDir, { recursive: true })
  if (existsSync(currentDataFile)) {
    try {
      const saved = JSON.parse(readFileSync(currentDataFile, 'utf-8'))
      store = migrateStore(saved)
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

// ─── AI 配置继承 ───

export function resolveAIConfig(project: Project, volume?: Volume | null): BookAIConfig {
  const base = project.aiConfig || DEFAULT_BOOK_AI_CONFIG
  if (!volume?.aiConfig || Object.keys(volume.aiConfig).length === 0) return base
  return { ...base, ...volume.aiConfig }
}

// ─── Projects ───

export function getProjects(): Project[] {
  return [...store.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createProject(name: string, genre?: string | null): Project {
  const now = new Date().toISOString()
  const aiConfig: BookAIConfig = { ...DEFAULT_BOOK_AI_CONFIG, genre: genre || null }
  const project: Project = { id: randomUUID(), name, genre: genre || null, aiConfig, createdAt: now, updatedAt: now }
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
  const chapterIds = store.chapters.filter(c => c.projectId === id).map(c => c.id)
  for (const cid of chapterIds) {
    delete store.versions[cid]
  }
  store.chapters = store.chapters.filter(c => c.projectId !== id)
  store.volumes = store.volumes.filter(v => v.projectId !== id)
  store.projects = store.projects.filter(p => p.id !== id)
  save()
}

export function updateProjectAIConfig(projectId: string, config: Partial<BookAIConfig>): void {
  const project = store.projects.find(p => p.id === projectId)
  if (!project) return
  project.aiConfig = { ...project.aiConfig, ...config }
  if (config.genre !== undefined) project.genre = config.genre
  project.updatedAt = new Date().toISOString()
  save()
}

// ─── Volumes ───

export function getVolumes(projectId: string): Volume[] {
  return store.volumes
    .filter(v => v.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function createVolume(projectId: string, name: string): Volume {
  const now = new Date().toISOString()
  const maxOrder = store.volumes
    .filter(v => v.projectId === projectId)
    .reduce((max, v) => Math.max(max, v.orderIndex), -1)
  const volume: Volume = {
    id: randomUUID(),
    projectId,
    name,
    aiConfig: {},
    orderIndex: maxOrder + 1,
    createdAt: now,
    updatedAt: now
  }
  store.volumes.push(volume)
  save()
  return volume
}

export function renameVolume(id: string, name: string): void {
  const volume = store.volumes.find(v => v.id === id)
  if (!volume) return
  volume.name = name
  volume.updatedAt = new Date().toISOString()
  save()
}

export function updateVolume(id: string, data: Partial<Volume>): void {
  const volume = store.volumes.find(v => v.id === id)
  if (!volume) return
  if (data.name !== undefined) volume.name = data.name
  if (data.aiConfig !== undefined) volume.aiConfig = data.aiConfig
  volume.updatedAt = new Date().toISOString()
  save()
}

export function deleteVolume(id: string): void {
  // 将下属章节的 volumeId 设为 null
  for (const ch of store.chapters) {
    if (ch.volumeId === id) ch.volumeId = null
  }
  store.volumes = store.volumes.filter(v => v.id !== id)
  save()
}

// ─── Chapters ───

export function getChapters(projectId: string): Chapter[] {
  return store.chapters
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function createChapter(projectId: string, title: string, volumeId?: string | null): Chapter {
  const now = new Date().toISOString()
  const maxOrder = store.chapters
    .filter(c => c.projectId === projectId)
    .reduce((max, c) => Math.max(max, c.orderIndex), -1)
  const chapter: Chapter = {
    id: randomUUID(),
    projectId,
    volumeId: volumeId || null,
    title,
    content: '',
    polishingMarks: [],
    summaryResult: null,
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
  if (data.volumeId !== undefined) chapter.volumeId = data.volumeId
  if (data.summaryResult !== undefined) chapter.summaryResult = data.summaryResult
  chapter.updatedAt = new Date().toISOString()
  save()
}

export function deleteChapter(id: string): void {
  store.chapters = store.chapters.filter(c => c.id !== id)
  delete store.versions[id]
  save()
}

export function updateChapterSummary(chapterId: string, summary: string | null): void {
  const chapter = store.chapters.find(c => c.id === chapterId)
  if (!chapter) return
  chapter.summaryResult = summary
  chapter.updatedAt = new Date().toISOString()
  save()
}

// ─── Versions ───

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

// ─── LLM Config ───

export function getLLMConfig(): LLMConfig {
  return { ...store.llmConfig }
}

export function saveLLMConfig(config: LLMConfig): void {
  store.llmConfig = config
  save()
}

// ─── Conversations ───

function getEntityIdField(level: DialogueLevel): 'projectId' | 'volumeId' | 'chapterId' {
  if (level === 'book') return 'projectId'
  if (level === 'volume') return 'volumeId'
  return 'chapterId'
}

export function getConversation(level: DialogueLevel, entityId: string): Conversation | undefined {
  const field = getEntityIdField(level)
  return store.conversations.find(c => c.level === level && c[field] === entityId)
}

export function saveConversation(conversation: Conversation): void {
  const idx = store.conversations.findIndex(c => c.id === conversation.id)
  if (idx >= 0) {
    store.conversations[idx] = conversation
  } else {
    store.conversations.push(conversation)
  }
  save()
}

export function deleteConversation(level: DialogueLevel, entityId: string): void {
  const field = getEntityIdField(level)
  store.conversations = store.conversations.filter(
    c => !(c.level === level && c[field] === entityId)
  )
  save()
}
