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
  writingGuidance: WritingGuidance
}

export const DEFAULT_BOOK_AI_CONFIG: BookAIConfig = {
  genre: null,
  polishStandard: '',
  summaryStandard: '',
  customPrompt: '',
  writingGuidance: { ...DEFAULT_WRITING_GUIDANCE }
}

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

export interface Project {
  id: string
  name: string
  genre: string | null
  aiConfig: BookAIConfig
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

export type DialogueLevel = 'book' | 'volume' | 'chapter'

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

  // Outlines
  getOutline: (level: DialogueLevel, entityId: string) => Promise<Outline | undefined>
  saveOutline: (outline: Outline) => Promise<void>
  deleteOutline: (level: DialogueLevel, entityId: string) => Promise<void>
}
