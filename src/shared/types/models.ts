import type { BookAIConfig } from './api'

// ─── Writing Skills ───

export type SkillCategory = 'scene' | 'dialogue' | 'pacing' | 'formatting' | 'style' | 'character' | 'structure' | 'custom'

export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; icon: string }> = {
  scene: { label: '场景描写', icon: '🎬' },
  dialogue: { label: '对话风格', icon: '💬' },
  pacing: { label: '节奏把控', icon: '⚡' },
  formatting: { label: '排版规范', icon: '📝' },
  style: { label: '文风特征', icon: '✒️' },
  character: { label: '人物塑造', icon: '👤' },
  structure: { label: '结构技巧', icon: '🏗️' },
  custom: { label: '自定义', icon: '📌' }
}

export interface WritingSkill {
  id: string
  name: string
  category: SkillCategory
  content: string
  source?: string
  builtin?: boolean
  createdAt: string
  updatedAt: string
}

export interface SkillExportData {
  version: number
  exportedAt: string
  skills: Omit<WritingSkill, 'id' | 'createdAt' | 'updatedAt'>[]
}

// ─── Polish ───

export interface PolishResult {
  id: string
  original: string
  polished: string
  reason: string
  diffs: DiffItem[]
  accepted: boolean
  position: number // character offset in chapter content
}

export interface DiffItem {
  type: 'added' | 'removed' | 'unchanged'
  value: string
}

export interface PolishMark {
  id: string
  original: string
  polished: string
  reason: string
  position: number
  length: number
}

export interface AutoPolishResult {
  suggestions: PolishResult[]
}

// ─── Data Models ───

export interface Volume {
  id: string
  projectId: string
  name: string
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export interface FeatureSkillIds {
  dialogue: string[]
  polish: string[]
  summary: string[]
  continuation: string[]
  outline: string[]
  chapterContent: string[]
}

export const DEFAULT_FEATURE_SKILL_IDS: FeatureSkillIds = {
  dialogue: [],
  polish: [],
  summary: [],
  continuation: [],
  outline: [],
  chapterContent: []
}

export interface ProjectReasoningConfig {
  enabled: boolean
  autoTrigger: boolean
  defaultChainId: string | null
  includeInContextByDefault: boolean
  toolChainBindings: Record<string, string>  // toolName -> reasoningChainId
}

export interface Project {
  id: string
  name: string
  genre: string | null
  aiConfig: BookAIConfig
  enabledSkillIds?: string[] // legacy, migrated to featureSkillIds
  featureSkillIds?: FeatureSkillIds
  reasoningConfig?: ProjectReasoningConfig
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: string
  projectId: string
  volumeId: string | null      // 所属卷 ID，null = 未分卷
  title: string
  content: string
  polishingMarks: PolishMark[]
  summaryResult: string | null // 保存的摘要结果
  orderIndex: number
  createdAt: string
  updatedAt: string
}

export interface VersionSnapshot {
  content: string
  polishingMarks: PolishMark[]
  timestamp: string
}

export interface ExportOptions {
  projectName: string
  chapters: { title: string; content: string }[]
  format: 'txt' | 'md'
  mode: 'separate' | 'merged'
}

// ─── Import ───

export interface ImportPreview {
  bookName: string
  chapters: { title: string; content: string }[]
  totalChars: number
}

export interface ImportConfirmResult {
  project: Project
  volume: Volume
  chapterCount: number
}

// ─── Outline ───

export interface Outline {
  id: string
  projectId: string | null
  volumeId: string | null
  chapterId: string | null
  level: 'book' | 'volume' | 'chapter'
  content: string
  createdAt: string
  updatedAt: string
}

// ─── Reasoning Chain ───

export interface ReasoningStep {
  id: string
  name: string           // 步骤名称，如"人物心理分析"
  prompt: string         // 该步骤的提示词
  outputKey: string      // 输出存储的 key，供后续步骤引用
  optional?: boolean     // 是否可选
  dependsOn?: string[]   // 依赖的 outputKey 列表，为空则无依赖可并发
}

export interface ReasoningContextConfig {
  bookOutline: boolean      // 书籍大纲
  volumeOutline: boolean    // 卷大纲
  chapterOutline: boolean   // 章节大纲
  previousSummaries: boolean // 前文章节摘要
  dialogueHistory: boolean  // 对话历史
}

export const DEFAULT_REASONING_CONTEXT_CONFIG: ReasoningContextConfig = {
  bookOutline: true,
  volumeOutline: true,
  chapterOutline: true,
  previousSummaries: true,
  dialogueHistory: false
}

export interface ReasoningChain {
  id: string
  name: string           // 推理链名称，如"章节创作推理"
  description: string
  trigger: 'auto' | 'manual'
  steps: ReasoningStep[]
  includeInContext: boolean   // 推理结果是否纳入上下文
  contextConfig: ReasoningContextConfig  // 上下文配置
  builtin: boolean
}

export interface ReasoningStepResult {
  chainId: string
  stepId: string
  stepName: string
  result: string
  status: 'running' | 'done' | 'error'
}

export interface ReasoningSession {
  id: string
  chainId: string
  chainName: string
  steps: ReasoningStepResult[]
  context: string        // 触发推理时的上下文
  status: 'running' | 'completed' | 'error'
  includeInContext: boolean
  createdAt: string
}

// ─── App Update ───

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  version?: string
  releaseNotes?: string
  progress?: { percent: number; transferred: number; total: number }
  error?: string
  giteeInstallerPath?: string
}

export interface WallpaperInfo {
  id: string
  name: string
  file: string
  type: string
  preview?: string
}
