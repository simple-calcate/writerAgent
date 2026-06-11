import { app, shell } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Project, Chapter, Volume, LLMConfig, APIProfile, VersionSnapshot, Conversation, Outline, WritingSkill, ReasoningChain } from '../../shared/types'
import { DEFAULT_BOOK_AI_CONFIG, DEFAULT_KEY_BINDINGS, DEFAULT_CONTINUATION_CONFIG, BUILTIN_SKILLS } from '../../shared/types'

export interface Store {
  projects: Project[]
  volumes: Volume[]
  chapters: Chapter[]
  llmConfig: LLMConfig
  versions: Record<string, VersionSnapshot[]>
  conversations: Conversation[]
  outlines: Outline[]
  skills: WritingSkill[]
  reasoningChains: ReasoningChain[]
}

const defaultProfileId = 'default-profile'

const defaultStore: Store = {
  projects: [],
  volumes: [],
  chapters: [],
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
    continuationConfig: { ...DEFAULT_CONTINUATION_CONFIG },
    braveSearchApiKey: ''
  },
  versions: {},
  conversations: [],
  outlines: [],
  skills: [],
  reasoningChains: []
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

let _store: Store
let currentDataDir: string
let currentDataFile: string

// Export getters so other modules can access the shared state
export function getStore(): Store { return _store }
export function save(): void {
  writeFileSync(currentDataFile, JSON.stringify(_store, null, 2), 'utf-8')
}

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
      _store = migrateStore(saved)
    } catch {
      _store = { ...defaultStore }
    }
  } else {
    _store = { ...defaultStore }
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
      _store = migrateStore(saved)
    } catch {
      _store = { ...defaultStore }
    }
  } else {
    _store = { ...defaultStore }
  }
}
