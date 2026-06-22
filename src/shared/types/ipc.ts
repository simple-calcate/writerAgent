import type { BookAIConfig, LLMConfig, LLMConfigSingle } from './api'
import type {
  Project, Volume, Chapter, PolishResult, AutoPolishResult,
  VersionSnapshot, ExportOptions, ImportPreview, ImportConfirmResult,
  WritingSkill, FeatureSkillIds, ProjectReasoningConfig,
  ReasoningChain, Outline, UpdateStatus, WallpaperInfo
} from './models'
import type {
  DialogueLevel, Conversation, DialogueStreamChunk, DialogueStreamDone,
  DialogueStreamError, DialogueToolStart, DialogueToolDone,
  DialogueToolApproval, DialogueToolApprovalResponse,
  DialogueThinkingChunk, DialogueThinkingDone,
  AIThinkingChunk, AIThinkingDone
} from './dialogue'
import type {
  AgentPhaseChange, AgentSubTaskUpdate, AgentCriticResult, AgentTaskComplete,
  WritingPhase, WACState, AgentFlowSnapshot, WritingTrajectory,
  IntentClassifierResult
} from './agent'

export interface IPCAPI {
  // AI
  autoPolish: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<AutoPolishResult>
  polishText: (original: string, context: string) => Promise<PolishResult>
  summarizeChapter: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<string>
  refineSummary: (content: string, aiConfig?: Partial<BookAIConfig>) => Promise<string>

  // Config
  getLLMConfig: () => Promise<LLMConfig>
  saveLLMConfig: (config: LLMConfig) => Promise<void>
  diagnoseLocalModel: (config: LLMConfigSingle) => Promise<string[]>
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
  updateProjectReasoningConfig: (projectId: string, config: ProjectReasoningConfig) => Promise<void>

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

  // Reasoning Chains
  getReasoningChains: () => Promise<ReasoningChain[]>
  saveReasoningChain: (chain: ReasoningChain) => Promise<void>
  deleteReasoningChain: (id: string) => Promise<void>

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
  resolveDialogueContextWindow: () => Promise<number | null>
  dialogueCompress: (level: DialogueLevel, entityId: string) => Promise<{ compressedCount: number; summary: string }>

  // Reasoning
  onReasoningStart: (callback: (data: any) => void) => () => void
  onReasoningStepStart: (callback: (data: any) => void) => () => void
  onReasoningStepDone: (callback: (data: any) => void) => () => void
  onReasoningStepError: (callback: (data: any) => void) => () => void
  onReasoningDone: (callback: (data: any) => void) => () => void

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
  downloadFromGitee: () => Promise<void>
  cancelGiteeDownload: () => Promise<void>
  installGiteeUpdate: () => Promise<void>
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

  // Agent (Writer Agent System)
  agentProcess: (level: DialogueLevel, entityId: string, userRequest: string) => Promise<{ streamId: string }>
  agentCancel: () => Promise<void>
  agentGetState: () => Promise<WACState>
  agentRoute: (level: DialogueLevel, entityId: string, input: string) => Promise<{ classification: IntentClassifierResult; result: any }>
  agentApproveRewrite: (approvalId: string, approved: boolean) => Promise<void>
  onAgentRewriteApproval: (callback: (data: { approvalId: string; taskId: string; score: any; strategy: string; instruction: string; round: number }) => void) => () => void
  onAgentPhaseChange: (callback: (data: AgentPhaseChange) => void) => () => void
  onAgentSubTaskUpdate: (callback: (data: AgentSubTaskUpdate) => void) => () => void
  onAgentCriticResult: (callback: (data: AgentCriticResult) => void) => () => void
  onAgentTaskComplete: (callback: (data: AgentTaskComplete) => void) => () => void
  onAgentChunk: (callback: (data: { streamId: string; chunk: string }) => void) => () => void
  onAgentThinkingChunk: (callback: (data: { streamId: string; chunk: string }) => void) => () => void
  onAgentThinkingDone: (callback: (data: { streamId: string }) => void) => () => void
  onAgentFlowUpdate: (callback: (data: AgentFlowSnapshot) => void) => () => void
  onAgentTrajectory: (callback: (data: WritingTrajectory) => void) => () => void

  // Memory
  memoryGetContext: (projectId: string) => Promise<{ episodic: string; semantic: string; style: string; dialogue: string; combined: string }>
  memoryGetSummary: (projectId: string) => Promise<{ episodicCount: number; semanticCount: number; styleCount: number; dialogueCount: number; lastUpdated: string | null }>
  memoryClear: (projectId: string, layer: 'episodic' | 'semantic' | 'style' | 'dialogue' | 'all') => Promise<void>
}
