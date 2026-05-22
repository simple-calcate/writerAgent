import { app, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Project, Chapter, Volume, LLMConfig, LLMConfigSingle, APIProfile, AIFeatureConfig, AIFeatureEntry, VersionSnapshot, BookAIConfig, Conversation, DialogueLevel, Outline, WritingSkill, FeatureSkillIds } from '../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG, DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG, BUILTIN_SKILLS } from '../../shared/types'

interface Store {
  projects: Project[]
  volumes: Volume[]
  chapters: Chapter[]
  llmConfig: LLMConfig
  versions: Record<string, VersionSnapshot[]>
  conversations: Conversation[]
  outlines: Outline[]
  skills: WritingSkill[]
}

const defaultProfileId = 'default-profile'

const defaultStore: Store = {
  projects: [],
  volumes: [],
  chapters: [],
  llmConfig: {
    profiles: [{
      id: defaultProfileId,
      name: '默认',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini'
    }],
    defaultProfileId,
    aiFeatures: {
      polish: { enabled: true, profileId: null },
      summary: { enabled: true, profileId: null },
      dialogue: { enabled: true, profileId: null },
      refineSummary: { enabled: true, profileId: null }
    },
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
    continuationConfig: { ...DEFAULT_CONTINUATION_CONFIG }
  },
  versions: {},
  conversations: [],
  outlines: [],
  skills: []
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
    volumes: saved.volumes || [],
    conversations: saved.conversations || [],
    outlines: saved.outlines || [],
    skills: saved.skills || []
  }

  // 迁移 LLMConfig：旧格式 { apiKey, baseUrl, model, aiFeatures } → 新格式 { profiles, defaultProfileId, aiFeatures }
  if (saved.llmConfig && saved.llmConfig.profiles) {
    // 已经是新格式，合并默认值
    migrated.llmConfig = {
      ...defaultStore.llmConfig,
      ...saved.llmConfig,
      aiFeatures: {
        ...defaultStore.llmConfig.aiFeatures,
        ...Object.fromEntries(
          Object.entries(saved.llmConfig.aiFeatures || {}).map(([k, v]: [string, any]) => {
            if (typeof v === 'boolean') {
              return [k, { enabled: v, profileId: null }]
            }
            return [k, { ...{ enabled: true, profileId: null }, ...v }]
          })
        )
      }
    }
  } else if (saved.llmConfig) {
    // 旧格式迁移
    const oldConfig = saved.llmConfig
    const profileId = defaultProfileId
    const profile: APIProfile = {
      id: profileId,
      name: '默认',
      apiKey: oldConfig.apiKey || '',
      baseUrl: oldConfig.baseUrl || 'https://api.openai.com/v1',
      model: oldConfig.model || 'gpt-4o-mini'
    }
    const oldFeatures = oldConfig.aiFeatures || {}
    migrated.llmConfig = {
      profiles: [profile],
      defaultProfileId: profileId,
      aiFeatures: {
        polish: { enabled: oldFeatures.polish !== false, profileId: null },
        summary: { enabled: oldFeatures.summary !== false, profileId: null },
        dialogue: { enabled: oldFeatures.dialogue !== false, profileId: null },
        refineSummary: { enabled: true, profileId: null }
      }
    }
  } else {
    migrated.llmConfig = { ...defaultStore.llmConfig }
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

  // 迁移 writingGuidance → skills
  const existingSkillNames = new Set(migrated.skills.map((s: any) => s.name))
  const now = new Date().toISOString()
  const wgFieldMap: [string, string, string][] = [
    ['dialogue', 'dialogue', '对话风格指导'],
    ['scene', 'scene', '场景描写指导'],
    ['emotion', 'character', '情感描写指导'],
    ['action', 'scene', '动作描写指导'],
    ['pacing', 'pacing', '节奏把控指导'],
    ['custom', 'custom', '自定义写作指导']
  ]

  function migrateWritingGuidance(wg: any, targetSkillIds: string[], source: string) {
    if (!wg) return
    for (const [field, category, skillName] of wgFieldMap) {
      const content = wg[field]
      if (!content || !content.trim()) continue
      // Find existing skill by name
      let skill = migrated.skills.find((s: any) => s.name === skillName)
      if (!skill) {
        // Create new skill
        skill = { id: randomUUID(), name: skillName, category, content: content.trim(), source, createdAt: now, updatedAt: now }
        migrated.skills.push(skill)
        existingSkillNames.add(skillName)
      }
      if (!targetSkillIds.includes(skill.id)) {
        targetSkillIds.push(skill.id)
      }
    }
  }

  for (const p of migrated.projects) {
    if (!p.enabledSkillIds) p.enabledSkillIds = []
    if (p.aiConfig?.writingGuidance) {
      migrateWritingGuidance(p.aiConfig.writingGuidance, p.enabledSkillIds, `迁移自《${p.name}》书籍配置`)
      delete p.aiConfig.writingGuidance
    }
  }
  for (const v of migrated.volumes) {
    if (v.aiConfig?.writingGuidance) {
      delete v.aiConfig.writingGuidance
    }
  }

  // 内置技能：自动创建
  const builtinSkillIds: string[] = []
  for (const builtin of BUILTIN_SKILLS) {
    let skill = migrated.skills.find((s: any) => s.name === builtin.name)
    if (!skill) {
      skill = { ...builtin, id: randomUUID(), createdAt: now, updatedAt: now }
      migrated.skills.push(skill)
    } else if (!skill.builtin) {
      skill.builtin = true
    }
    builtinSkillIds.push(skill.id)
  }

  // Helper: get skill IDs by category
  const getSkillIdsByCategories = (categories: string[]) =>
    migrated.skills
      .filter((s: any) => categories.includes(s.category))
      .map((s: any) => s.id)

  // Default feature assignments based on skill categories
  const defaultDialogueIds = builtinSkillIds // all built-in skills for dialogue
  const defaultPolishIds = getSkillIdsByCategories(['style', 'formatting'])
  const defaultSummaryIds: string[] = [] // no skills for summary
  const defaultContinuationIds = getSkillIdsByCategories(['scene', 'dialogue', 'pacing', 'style', 'character', 'structure'])

  // Migrate enabledSkillIds → featureSkillIds
  for (const p of migrated.projects) {
    if (!p.featureSkillIds) {
      const ids = p.enabledSkillIds || []
      // If project has old enabledSkillIds, use them for dialogue; use defaults for others
      p.featureSkillIds = {
        dialogue: ids.length > 0 ? [...ids] : [...defaultDialogueIds],
        polish: ids.length > 0 ? [...ids] : [...defaultPolishIds],
        summary: ids.length > 0 ? [...ids] : [...defaultSummaryIds],
        continuation: ids.length > 0 ? [...ids] : [...defaultContinuationIds]
      }
    }
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

  // Default feature skill assignments based on skill categories
  const getSkillIdsByCategories = (categories: string[]) =>
    store.skills.filter(s => categories.includes(s.category)).map(s => s.id)

  const builtinIds = store.skills.filter(s => s.builtin).map(s => s.id)
  const featureSkillIds: FeatureSkillIds = {
    dialogue: [...builtinIds],
    polish: getSkillIdsByCategories(['style', 'formatting']),
    summary: [],
    continuation: getSkillIdsByCategories(['scene', 'dialogue', 'pacing', 'style', 'character', 'structure'])
  }

  const project: Project = { id: randomUUID(), name, genre: genre || null, aiConfig, featureSkillIds, createdAt: now, updatedAt: now }
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
  store.outlines = store.outlines.filter(o => o.projectId !== id)
  store.conversations = store.conversations.filter(c => c.projectId !== id)
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

export function updateProjectEnabledSkills(projectId: string, skillIds: string[]): void {
  const project = store.projects.find(p => p.id === projectId)
  if (!project) return
  project.enabledSkillIds = skillIds
  project.updatedAt = new Date().toISOString()
  save()
}

export function updateProjectFeatureSkillIds(projectId: string, featureSkillIds: FeatureSkillIds): void {
  const project = store.projects.find(p => p.id === projectId)
  if (!project) return
  project.featureSkillIds = featureSkillIds
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
  store.outlines = store.outlines.filter(o => o.volumeId !== id)
  store.conversations = store.conversations.filter(c => c.volumeId !== id)
  store.volumes = store.volumes.filter(v => v.id !== id)
  save()
}

// ─── Chapters ───

export function getChapters(projectId: string): Chapter[] {
  return store.chapters
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

export function createChapter(projectId: string, title: string, volumeId?: string | null): Chapter | null {
  // 检查同卷下是否有同名章节
  const duplicate = store.chapters.find(
    c => c.projectId === projectId && c.volumeId === (volumeId || null) && c.title === title
  )
  if (duplicate) return null

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
  store.outlines = store.outlines.filter(o => o.chapterId !== id)
  store.conversations = store.conversations.filter(c => c.chapterId !== id)
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

export function getDefaultProfile(): APIProfile | null {
  const { profiles, defaultProfileId } = store.llmConfig
  return profiles.find(p => p.id === defaultProfileId) || profiles[0] || null
}

export function resolveFeatureConfig(feature: keyof AIFeatureConfig): LLMConfigSingle | null {
  const { profiles, defaultProfileId, aiFeatures } = store.llmConfig
  const featureConf = aiFeatures[feature]
  if (!featureConf || !featureConf.enabled) return null
  const profileId = featureConf.profileId || defaultProfileId
  const profile = profiles.find(p => p.id === profileId) || profiles[0]
  if (!profile) return null
  const thinkingDepth = featureConf.thinkingDepth || profile.thinkingDepth
  const maxTokens = featureConf.maxTokens && featureConf.maxTokens > 0
    ? Math.min(featureConf.maxTokens * 1000, 390000)
    : undefined
  return { apiKey: profile.apiKey, baseUrl: profile.baseUrl, model: profile.model, thinkingDepth, maxTokens }
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

// ─── Outlines ───

export function getOutline(level: DialogueLevel, entityId: string): Outline | undefined {
  const field = getEntityIdField(level)
  return store.outlines.find(o => o.level === level && o[field] === entityId)
}

export function saveOutline(outline: Outline): void {
  const idx = store.outlines.findIndex(o => o.id === outline.id)
  if (idx >= 0) {
    store.outlines[idx] = outline
  } else {
    store.outlines.push(outline)
  }
  save()
}

export function deleteOutline(level: DialogueLevel, entityId: string): void {
  const field = getEntityIdField(level)
  store.outlines = store.outlines.filter(
    o => !(o.level === level && o[field] === entityId)
  )
  save()
}

// ─── Skills ───

export function getSkills(): WritingSkill[] {
  return [...store.skills].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveSkill(skill: WritingSkill): void {
  const idx = store.skills.findIndex(s => s.id === skill.id)
  if (idx >= 0) {
    store.skills[idx] = skill
  } else {
    store.skills.push(skill)
  }
  save()
}

export function deleteSkill(id: string): void {
  store.skills = store.skills.filter(s => s.id !== id)
  // Remove from all projects' enabledSkillIds
  for (const p of store.projects) {
    if (p.enabledSkillIds) {
      p.enabledSkillIds = p.enabledSkillIds.filter(sid => sid !== id)
    }
  }
  save()
}

export function saveSkills(skills: WritingSkill[]): void {
  for (const skill of skills) {
    const idx = store.skills.findIndex(s => s.id === skill.id)
    if (idx >= 0) {
      store.skills[idx] = skill
    } else {
      store.skills.push(skill)
    }
  }
  save()
}
