export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
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

export interface Project {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: string
  projectId: string
  title: string
  content: string
  polishingMarks: PolishMark[] // AI replacements applied
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

export interface IPCAPI {
  autoPolish: (content: string) => Promise<AutoPolishResult>
  polishText: (original: string, context: string) => Promise<PolishResult>
  getLLMConfig: () => Promise<LLMConfig>
  saveLLMConfig: (config: LLMConfig) => Promise<void>
  getProjects: () => Promise<Project[]>
  createProject: (name: string) => Promise<Project>
  renameProject: (id: string, name: string) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  getChapters: (projectId: string) => Promise<Chapter[]>
  createChapter: (projectId: string, title: string) => Promise<Chapter>
  renameChapter: (id: string, title: string) => Promise<void>
  updateChapter: (id: string, data: Partial<Chapter>) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  summarizeChapter: (content: string) => Promise<string>
}
