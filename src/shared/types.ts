export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
  aiFeatures: AIFeatureConfig
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

export interface AIFeatureConfig {
  polish: boolean
  summary: boolean
  [key: string]: boolean
}

export interface IPCAPI {
  // AI
  autoPolish: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<AutoPolishResult>
  polishText: (original: string, context: string) => Promise<PolishResult>
  summarizeChapter: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<string>

  // Config
  getLLMConfig: () => Promise<LLMConfig>
  saveLLMConfig: (config: LLMConfig) => Promise<void>
  getDataPath: () => Promise<string>
  getDataPathDefault: () => Promise<string>
  setDataPath: (newPath: string) => Promise<void>
  openDataFolder: () => Promise<void>

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
  createChapter: (projectId: string, title: string, volumeId?: string | null) => Promise<Chapter>
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
}
