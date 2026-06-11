// ─── 思考深度 ───

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
  contextWindow?: number         // 上下文窗口大小（token 数），可选
}

// 单个 API 配置（用于实际调用）
export interface LLMConfigSingle {
  apiKey: string
  baseUrl: string
  model: string
  thinkingDepth?: ThinkingDepth
  maxTokens?: number  // 实际 token 数（已从"万"转换）
  contextWindow?: number  // 上下文窗口大小（token 数）
}

// AI 功能开关 + API 绑定
export interface AIFeatureEntry {
  enabled: boolean
  profileId: string | null  // null = 使用默认配置
  thinkingDepth?: ThinkingDepth  // 可选，覆盖 API 配置中的思考深度
  maxTokens?: number  // 单位：k，可选，不设则使用 API 默认值
  contextWindow?: number  // 上下文窗口大小（token 数），可选，覆盖 profile 配置
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

// 上下文管理配置
export interface ContextConfig {
  // 系统提示词预算分配
  outputReserveRatio: number       // 输出预留比例 (0-1)，默认 0.25
  chapterBudgetRatio: number       // 章节内容预算占比 (0-1)，默认 0.30
  outlineBudgetRatio: number       // 大纲预算占比 (0-1)，默认 0.15
  historyBudgetRatio: number       // 对话历史预算占比 (0-1)，默认 0.25

  // 对话历史压缩
  keepRecentRounds: number         // 保留最近对话轮数，默认 20
  summaryBudget: number            // 压缩摘要 token 上限，默认 800

  // 工具结果限制
  toolResultBudgetRatio: number    // 工具结果总预算占比 (0-1)，默认 0.15
  summarizeResultLimit: number     // summarize_chapter 结果 token 上限，默认 2000
  refineResultLimit: number        // refine_summary 结果 token 上限，默认 1000
  readContentResultLimit: number   // read_chapter_content 结果 token 上限，默认 4000
  defaultToolResultLimit: number   // 默认工具结果 token 上限，默认 2000
}

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  outputReserveRatio: 0.25,
  chapterBudgetRatio: 0.30,
  outlineBudgetRatio: 0.15,
  historyBudgetRatio: 0.25,
  keepRecentRounds: 20,
  summaryBudget: 800,
  toolResultBudgetRatio: 0.15,
  summarizeResultLimit: 2000,
  refineResultLimit: 1000,
  readContentResultLimit: 4000,
  defaultToolResultLimit: 2000
}

// 全局 LLM 配置
export interface LLMConfig {
  profiles: APIProfile[]
  defaultProfileId: string | null
  aiFeatures: AIFeatureConfig
  keyBindings?: KeyBindings  // 可选，向后兼容
  continuationConfig?: ContinuationConfig  // 可选，向后兼容
  contextConfig?: ContextConfig  // 可选，向后兼容
  braveSearchApiKey?: string  // Brave Search API Key，可选
}

// AI 高级配置（书籍/卷级别可设）
export interface AIFeatureAdvancedConfig {
  temperature?: number       // 0-2，默认使用各功能的硬编码值
  systemPrompt?: string      // 覆盖内置技能的系统提示词（为空则使用内置技能）
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

export interface BookAIConfig {
  genre: string | null
  polishStandard: string
  summaryStandard: string
  customPrompt: string

  // 每个功能的高级配置（可选，不设置则使用默认值）
  polishAdvanced?: AIFeatureAdvancedConfig
  summaryAdvanced?: AIFeatureAdvancedConfig
  continuationAdvanced?: AIFeatureAdvancedConfig
  dialogueAdvanced?: AIFeatureAdvancedConfig
  refineSummaryAdvanced?: AIFeatureAdvancedConfig
  outlineAdvanced?: AIFeatureAdvancedConfig
  chapterContentAdvanced?: AIFeatureAdvancedConfig
}

export const DEFAULT_BOOK_AI_CONFIG: BookAIConfig = {
  genre: null,
  polishStandard: '',
  summaryStandard: '',
  customPrompt: ''
}
