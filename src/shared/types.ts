// 思考深度
export type ThinkingDepthPreset = 'off' | 'low' | 'medium' | 'high'

export interface ThinkingDepth {
  preset: ThinkingDepthPreset | 'custom'
  budgetTokens?: number  // custom 模式下用户自定义的 token 预算
}

export type APIProvider = 'deepseek' | 'openai' | 'claude' | 'qwen' | 'moonshot' | 'ollama' | 'openrouter' | 'generic'

// API 配置档案
export interface APIProfile {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  model: string
  thinkingDepth?: ThinkingDepth  // 可选，向后兼容
}

// 单个 API 配置（用于实际调用）
export interface LLMConfigSingle {
  apiKey: string
  baseUrl: string
  model: string
  thinkingDepth?: ThinkingDepth
  maxTokens?: number  // 实际 token 数（已从"万"转换）
}

// AI 功能开关 + API 绑定
export interface AIFeatureEntry {
  enabled: boolean
  profileId: string | null  // null = 使用默认配置
  thinkingDepth?: ThinkingDepth  // 可选，覆盖 API 配置中的思考深度
  maxTokens?: number  // 单位：k，可选，不设则使用 API 默认值
}

export interface AIFeatureConfig {
  polish: AIFeatureEntry
  summary: AIFeatureEntry
  dialogue: AIFeatureEntry
  refineSummary: AIFeatureEntry
}

// 快捷键配置
export interface KeyBindings {
  acceptContinuation: string  // 接受续写建议，默认 Tab
  undo: string                // 撤销，默认 Ctrl+Z
  save: string                // 保存，默认空
  dismissContinuation: string // 取消续写建议，默认空
}

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  acceptContinuation: 'Tab',
  undo: 'Ctrl+Z',
  save: '',
  dismissContinuation: ''
}

// 续写配置
export interface ContinuationConfig {
  enabled: boolean
  delayMs: number             // 正文触发延迟（毫秒），默认 10000
  commentDelayMs: number      // 注释触发延迟（毫秒），默认 2000
}

export const DEFAULT_CONTINUATION_CONFIG: ContinuationConfig = {
  enabled: true,
  delayMs: 10000,
  commentDelayMs: 2000
}

// 全局 LLM 配置
export interface LLMConfig {
  profiles: APIProfile[]
  defaultProfileId: string | null
  aiFeatures: AIFeatureConfig
  keyBindings?: KeyBindings  // 可选，向后兼容
  continuationConfig?: ContinuationConfig  // 可选，向后兼容
}

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

// 写作指导意见
export interface WritingGuidance {
  dialogue: string   // 对话风格指导
  scene: string      // 场景描写指导
  emotion: string    // 情感描写指导
  action: string     // 动作描写指导
  pacing: string     // 节奏把控指导
  custom: string     // 其他自定义指导
}

export const DEFAULT_WRITING_GUIDANCE: WritingGuidance = {
  dialogue: '',
  scene: '',
  emotion: '',
  action: '',
  pacing: '',
  custom: ''
}

// AI 配置（书籍/卷级别可设）
export interface BookAIConfig {
  genre: string | null
  polishStandard: string
  summaryStandard: string
  customPrompt: string
}

export const DEFAULT_BOOK_AI_CONFIG: BookAIConfig = {
  genre: null,
  polishStandard: '',
  summaryStandard: '',
  customPrompt: ''
}

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

export const BUILTIN_SKILLS: Omit<WritingSkill, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '对话风格指导',
    category: 'dialogue',
    builtin: true,
    content: `## 对话写作原则

### 1. 口语化表达
- 避免书面语和翻译腔，使用自然流畅的口语
- 每个角色的说话方式应体现其性格、年龄、背景

### 2. 对话节奏
- 短句为主，避免长篇大论的对话
- 适当穿插动作描写，打破纯对话的单调感
- 关键台词前后留白，增强冲击力

### 3. 潜台词与弦外之音
- 角色不一定说出真实想法，通过语气、停顿、转移话题暗示
- 让读者能"读出"角色没说出口的话`
  },
  {
    name: '场景描写指导',
    category: 'scene',
    builtin: true,
    content: `## 场景描写原则

### 1. 感官细节
- 调动视觉、听觉、嗅觉、触觉、味觉，营造沉浸感
- 选择 1-2 个核心感官细节，避免面面俱到

### 2. 动态描写
- 场景不是静止的，加入细微的动态元素（风、光影、声音）
- 通过角色的行动来展现环境，而非纯粹的静态描述

### 3. 情绪映射
- 环境描写应与角色情绪呼应
- 紧张时环境压抑，放松时环境明亮`
  },
  {
    name: '节奏把控指导',
    category: 'pacing',
    builtin: true,
    content: `## 节奏控制原则

### 1. 张弛有度
- 高潮场景后安排缓冲段落，让读者喘息
- 紧张情节用短句，舒缓情节用长句

### 2. 章节结构
- 每章结尾留悬念或钩子，驱动读者继续阅读
- 开头快速切入，避免冗长的背景铺垫

### 3. 信息投放
- 新设定、新信息分批投放，避免信息过载
- 重要信息通过事件自然揭示，而非旁白讲解`
  },
  {
    name: '文风特征指导',
    category: 'style',
    builtin: true,
    content: `## 文风统一原则

### 1. 叙述视角
- 保持一致的叙述人称和视角
- 第一人称注意限制信息量，第三人称注意切换自然

### 2. 用词风格
- 全书用词风格统一，避免忽雅忽俗
- 根据题材选择合适的语言风格

### 3. 段落节奏
- 长短段落交替使用，制造阅读节奏感
- 关键场景用短段落增强冲击力`
  },
  {
    name: '人物塑造指导',
    category: 'character',
    builtin: true,
    content: `## 人物塑造原则

### 1. 性格一致性
- 角色行为应符合其已建立的性格特征
- 性格转变需要充分的铺垫和动机

### 2. 独特性
- 每个角色应有独特的说话方式、行为习惯、思维模式
- 通过细节而非标签来展现性格

### 3. 成长弧线
- 主角应有清晰的成长轨迹
- 配角也应有自己的目标和动机`
  },
  // ─── AI 功能指导（可自定义各功能的系统提示词） ───
  {
    name: '智能润色指导',
    category: 'formatting',
    builtin: true,
    content: `你是一位网文编辑，擅长发现并润色文字中需要改进的地方。

以下是一个网文章节，已按段落编号。请分析每个段落，找出需要润色的段落并直接给出润色后的版本。

要求：
- 只选择确实需要改进的段落，不要改动已经好的部分
- 最多选择5个最需要改进的段落
- 润色时保持原文意思完全不变，只改善用词、句式、描写
- 返回严格 JSON

输出格式：
{"results":[{"index":段落编号,"polished":"润色后的完整段落","reason":"改动理由"}]}`
  },
  {
    name: '结构化摘要指导',
    category: 'formatting',
    builtin: true,
    content: `你是网文写作分析助手。请对章节内容进行结构化总结，按以下格式输出（每个分类下用 - 开头的条目）：

1. 主要人物
- 人物名：状态/作用

2. 关键事件
- 事件描述

3. 伏笔
- 伏笔内容

4. 场景
- 场景描述

5. 情感
- 情感基调描述

要求：条目简洁，每个条目一行，不要展开论述。`
  },
  {
    name: '精炼总结指导',
    category: 'formatting',
    builtin: true,
    content: `你是一位网文写作分析助手。请按场景梳理这一章的剧情脉络，输出一段连贯的总结。

要求：
- 按场景顺序梳理：每个场景的核心事件、人物行动、情感变化
- 保留关键转折点和剧情推进的关键信息
- 如果有伏笔或悬念，明确指出
- 写成连贯段落，不要分条目
- 语言精炼，信息密度高，避免废话`
  },
  {
    name: '智能续写指导',
    category: 'formatting',
    builtin: true,
    content: `你是一位网文写作助手。作者正在写到章节末尾，需要你提供续写建议。不要解释、不要评论。

【注释模式】如果作者留下 // 注释，则根据上下文和大纲，直接输出能解答困惑的正文。

输出规则：
- 默认只写 1-2 句话，自然衔接前文
- 仅当大纲中明确描述了后续详细剧情时，才可以写 1 个自然段
- 保持与前文一致的文风和人称`
  },
  {
    name: '大纲撰写指导',
    category: 'formatting',
    builtin: true,
    content: `你是一位网文大纲策划师。撰写大纲时请遵循以下原则：

### 大纲结构
- 书籍大纲：世界观设定、核心冲突、角色体系、卷际节奏规划
- 卷纲：本卷主线/支线、关键转折点、章节分布、伏笔规划
- 章纲：核心事件、涉及人物、情感走向、与前后章的衔接

### 撰写要求
- 条目清晰，层次分明
- 保留足够的创作空间，不过度细化
- 标注伏笔的埋设和回收位置
- 考虑节奏起伏：高潮→缓冲→铺垫→高潮`
  },
  {
    name: '正文撰写指导',
    category: 'formatting',
    builtin: true,
    content: `你是一位网文写作助手，正在根据大纲为章节撰写正文。

### 撰写原则
- 严格遵循大纲中的核心事件和人物行为
- 保持与已有章节一致的文风、人称、叙述视角
- 场景描写调动感官细节，避免纯粹的静态描述
- 对话口语化，体现角色性格差异
- 章节结尾留悬念或钩子

### 输出格式
- 直接输出正文内容，不要加标题、编号或元描述
- 段落之间用空行分隔
- 对话用引号标注`
  }
]

// 卷
export interface Volume {
  id: string
  projectId: string
  name: string
  aiConfig: Partial<BookAIConfig>
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

export interface Project {
  id: string
  name: string
  genre: string | null
  aiConfig: BookAIConfig
  enabledSkillIds?: string[] // legacy, migrated to featureSkillIds
  featureSkillIds?: FeatureSkillIds
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

// ─── AI Dialogue ───

export type DialogueMode = 'chat' | 'plan'

export interface ToolCallInfo {
  id: string
  toolName: string
  displayName: string
  args: Record<string, string>
  status: 'running' | 'done' | 'pending_approval'
  result?: string
  needsApproval?: boolean
  approved?: boolean
  cachedResult?: string
  cacheHint?: string
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: ToolCallInfo[]
  thinkingContent?: string
}

export interface Conversation {
  id: string
  projectId: string | null
  volumeId: string | null
  chapterId: string | null
  level: 'book' | 'volume' | 'chapter'
  messages: ConversationMessage[]
  createdAt: string
  updatedAt: string
}

export interface DialogueStreamChunk {
  streamId: string
  chunk: string
}

export interface DialogueThinkingChunk {
  streamId: string
  chunk: string
}

export interface DialogueThinkingDone {
  streamId: string
}

export interface DialogueStreamDone {
  streamId: string
  fullText: string
}

export interface DialogueStreamError {
  streamId: string
  error: string
}

export interface DialogueToolStart {
  streamId: string
  toolCallId: string
  toolName: string
  args: Record<string, string>
}

export interface DialogueToolDone {
  streamId: string
  toolCallId: string
  toolName: string
  result: string
}

export interface DialogueToolApproval {
  streamId: string
  toolCallId: string
  toolName: string
  args: Record<string, string>
  approvalId: string
  displayName: string
  description: string
  cachedResult?: string
  cacheHint?: string
}

export interface DialogueToolApprovalResponse {
  approvalId: string
  approved: boolean
  refreshCache?: boolean
}

// ─── AI Thinking (通用，非对话专属) ───

export interface AIThinkingChunk {
  chunk: string
}

export interface AIThinkingDone {}

export type DialogueLevel = 'book' | 'volume' | 'chapter'

// ─── App Update ───

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  version?: string
  releaseNotes?: string
  progress?: { percent: number; transferred: number; total: number }
  error?: string
}

export interface IPCAPI {
  // AI
  autoPolish: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<AutoPolishResult>
  polishText: (original: string, context: string) => Promise<PolishResult>
  summarizeChapter: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<string>
  refineSummary: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<string>

  // Config
  getLLMConfig: () => Promise<LLMConfig>
  saveLLMConfig: (config: LLMConfig) => Promise<void>
  getDataPath: () => Promise<string>
  getDataPathDefault: () => Promise<string>
  setDataPath: (newPath: string) => Promise<void>
  openDataFolder: () => Promise<void>
  openExternal: (url: string) => Promise<void>

  // Projects
  getProjects: () => Promise<Project[]>
  createProject: (name: string, genre?: string | null) => Promise<Project>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  updateProjectAIConfig: (projectId: string, config: Partial<BookAIConfig>) => Promise<void>
  updateProjectEnabledSkills: (projectId: string, skillIds: string[]) => Promise<void>
  updateProjectFeatureSkillIds: (projectId: string, featureSkillIds: FeatureSkillIds) => Promise<void>

  // Volumes
  getVolumes: (projectId: string) => Promise<Volume[]>
  createVolume: (projectId: string, name: string) => Promise<Volume>
  renameVolume: (id: string, name: string) => Promise<void>
  updateVolume: (id: string, data: Partial<Volume>) => Promise<void>
  deleteVolume: (id: string) => Promise<void>

  // Chapters
  getChapters: (projectId: string) => Promise<Chapter[]>
  createChapter: (projectId: string, title: string, volumeId?: string | null) => Promise<Chapter | null>
  renameChapter: (id: string, title: string) => Promise<void>
  updateChapter: (id: string, data: Partial<Chapter>) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  updateChapterSummary: (chapterId: string, summary: string | null) => Promise<void>

  // Versions
  getVersions: (chapterId: string) => Promise<VersionSnapshot[]>
  saveVersion: (chapterId: string, version: VersionSnapshot) => Promise<void>
  deleteVersion: (chapterId: string, index: number) => Promise<void>

  // Export
  exportFiles: (options: ExportOptions) => Promise<boolean>

  // Import
  importBookPreview: () => Promise<ImportPreview | null>
  importBookConfirm: (bookName: string, chapters: { title: string; content: string }[]) => Promise<ImportConfirmResult>

  // Skills
  getSkills: () => Promise<WritingSkill[]>
  saveSkill: (skill: WritingSkill) => Promise<void>
  deleteSkill: (id: string) => Promise<void>
  exportSkills: (skillIds?: string[]) => Promise<boolean>
  importSkills: () => Promise<WritingSkill[] | null>
  importSkillsConfirm: (skills: WritingSkill[]) => Promise<void>

  // Continuation
  generateContinuation: (chapterId: string, cursorPosition: number, content: string) => Promise<string | null>

  // Dialogue
  dialogueSend: (level: DialogueLevel, entityId: string, messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<{ streamId: string }>
  dialogueCancel: (streamId: string) => Promise<void>
  getConversation: (level: DialogueLevel, entityId: string) => Promise<Conversation | undefined>
  saveConversation: (conversation: Conversation) => Promise<void>
  deleteConversation: (level: DialogueLevel, entityId: string) => Promise<void>
  onDialogueChunk: (callback: (data: DialogueStreamChunk) => void) => () => void
  onDialogueDone: (callback: (data: DialogueStreamDone) => void) => () => void
  onDialogueError: (callback: (data: DialogueStreamError) => void) => () => void
  onDialogueToolStart: (callback: (data: DialogueToolStart) => void) => () => void
  onDialogueToolDone: (callback: (data: DialogueToolDone) => void) => () => void
  onDialogueToolApproval: (callback: (data: DialogueToolApproval) => void) => () => void
  onDialogueThinkingChunk: (callback: (data: DialogueThinkingChunk) => void) => () => void
  onDialogueThinkingDone: (callback: (data: DialogueThinkingDone) => void) => () => void
  dialogueApproveTool: (response: DialogueToolApprovalResponse) => Promise<void>

  // AI Thinking (通用)
  onAIThinkingChunk: (callback: (data: AIThinkingChunk) => void) => () => void
  onAIThinkingDone: (callback: (data: AIThinkingDone) => void) => () => void
  aiCancel: () => Promise<void>

  // Outlines
  getOutline: (level: DialogueLevel, entityId: string) => Promise<Outline | undefined>
  saveOutline: (outline: Outline) => Promise<void>
  deleteOutline: (level: DialogueLevel, entityId: string) => Promise<void>

  // Update
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  getUpdateStatus: () => Promise<UpdateStatus>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
  getAppVersion: () => Promise<string>

  // Visual Effects
  selectBackgroundImage: () => Promise<string | null>
  detectSteamPath: () => Promise<string | null>
  selectFolder: () => Promise<string | null>
  scanWallpapers: (path: string) => Promise<WallpaperInfo[]>
  prepareWallpaper: (filePath: string) => Promise<string | null>
}

export interface WallpaperInfo {
  id: string
  name: string
  file: string
  type: string
  preview?: string
}
