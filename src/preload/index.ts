import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { IPCAPI, ExportOptions, BookAIConfig, DialogueLevel, Conversation, DialogueStreamChunk, DialogueStreamDone, DialogueStreamError, DialogueToolStart, DialogueToolDone, DialogueToolApproval, DialogueToolApprovalResponse, DialogueThinkingChunk, DialogueThinkingDone, AIThinkingChunk, AIThinkingDone, SummaryBatchProgressEvent, SummaryBatchDoneEvent, SummaryBatchErrorEvent, Outline, ImportPreview, ImportConfirmResult, WritingSkill, UpdateStatus, ReasoningChain, AgentPhaseChange, AgentSubTaskUpdate, AgentCriticResult, AgentTaskComplete, WACState, AgentFlowSnapshot, WritingTrajectory, FeatureSkillIds, ProjectReasoningConfig, ReasoningStartEvent, ReasoningStepStartEvent, ReasoningStepDoneEvent, ReasoningStepErrorEvent, ReasoningDoneEvent, AgentRewriteApprovalEvent } from '../shared/types'

const api: IPCAPI = {
  // AI
  autoPolish: (content: string, aiConfig?: Partial<BookAIConfig>) =>
    ipcRenderer.invoke('auto-polish', content, aiConfig),

  polishText: (original: string, context: string) =>
    ipcRenderer.invoke('polish-text', original, context),

  summarizeChapter: (content: string, aiConfig?: Partial<BookAIConfig>) =>
    ipcRenderer.invoke('summarize-chapter', content, aiConfig),

  refineSummary: (content: string, aiConfig?: Partial<BookAIConfig>) =>
    ipcRenderer.invoke('refine-summary', content, aiConfig),

  summarizeBatch: (chapterIds: string[], options?: { skipFresh?: boolean; aiConfig?: Partial<BookAIConfig> }) =>
    ipcRenderer.invoke('summarize-batch', chapterIds, options),

  summarizeBatchCancel: (batchId: string) =>
    ipcRenderer.invoke('summarize-batch-cancel', batchId),

  // Config
  getLLMConfig: () =>
    ipcRenderer.invoke('get-llm-config'),

  saveLLMConfig: (config) =>
    ipcRenderer.invoke('save-llm-config', config),

  diagnoseLocalModel: (config) =>
    ipcRenderer.invoke('diagnose-local-model', config),

  getDataPath: () =>
    ipcRenderer.invoke('get-data-path'),

  getDataPathDefault: () =>
    ipcRenderer.invoke('get-data-path-default'),

  setDataPath: (newPath: string) =>
    ipcRenderer.invoke('set-data-path', newPath),

  openDataFolder: () =>
    ipcRenderer.invoke('open-data-folder'),

  openExternal: (url: string) =>
    ipcRenderer.invoke('open-external', url),

  // Projects
  getProjects: () =>
    ipcRenderer.invoke('get-projects'),

  createProject: (name: string, genre?: string | null) =>
    ipcRenderer.invoke('create-project', name, genre),

  renameProject: (id: string, name: string) =>
    ipcRenderer.invoke('rename-project', id, name),

  deleteProject: (id: string) =>
    ipcRenderer.invoke('delete-project', id),

  updateProjectAIConfig: (projectId: string, config: Partial<BookAIConfig>) =>
    ipcRenderer.invoke('update-project-ai-config', projectId, config),

  // Volumes
  getVolumes: (projectId: string) =>
    ipcRenderer.invoke('get-volumes', projectId),

  createVolume: (projectId: string, name: string) =>
    ipcRenderer.invoke('create-volume', projectId, name),

  renameVolume: (id: string, name: string) =>
    ipcRenderer.invoke('rename-volume', id, name),

  updateVolume: (id: string, data) =>
    ipcRenderer.invoke('update-volume', id, data),

  deleteVolume: (id: string) =>
    ipcRenderer.invoke('delete-volume', id),

  // Chapters
  getChapters: (projectId: string) =>
    ipcRenderer.invoke('get-chapters', projectId),

  createChapter: (projectId: string, title: string, volumeId?: string | null) =>
    ipcRenderer.invoke('create-chapter', projectId, title, volumeId),

  renameChapter: (id: string, title: string) =>
    ipcRenderer.invoke('rename-chapter', id, title),

  updateChapter: (id: string, data) =>
    ipcRenderer.invoke('update-chapter', id, data),

  deleteChapter: (id: string) =>
    ipcRenderer.invoke('delete-chapter', id),

  updateChapterSummary: (chapterId: string, summary: string | null, contentHash?: string | null) =>
    ipcRenderer.invoke('update-chapter-summary', chapterId, summary, contentHash),

  // Versions
  getVersions: (chapterId: string) =>
    ipcRenderer.invoke('get-versions', chapterId),

  saveVersion: (chapterId: string, version) =>
    ipcRenderer.invoke('save-version', chapterId, version),

  deleteVersion: (chapterId: string, index: number) =>
    ipcRenderer.invoke('delete-version', chapterId, index),

  // Export
  exportFiles: (options: ExportOptions) =>
    ipcRenderer.invoke('export-files', options),

  // Import
  importBookPreview: () =>
    ipcRenderer.invoke('import-book-preview'),

  importBookConfirm: (bookName: string, chapters: { title: string; content: string }[]) =>
    ipcRenderer.invoke('import-book-confirm', bookName, chapters),

  // Skills
  getSkills: () =>
    ipcRenderer.invoke('get-skills'),

  saveSkill: (skill: WritingSkill) =>
    ipcRenderer.invoke('save-skill', skill),

  deleteSkill: (id: string) =>
    ipcRenderer.invoke('delete-skill', id),

  updateProjectEnabledSkills: (projectId: string, skillIds: string[]) =>
    ipcRenderer.invoke('update-project-enabled-skills', projectId, skillIds),

  updateProjectFeatureSkillIds: (projectId: string, featureSkillIds: FeatureSkillIds) =>
    ipcRenderer.invoke('update-project-feature-skill-ids', projectId, featureSkillIds),

  updateProjectReasoningConfig: (projectId: string, config: ProjectReasoningConfig) =>
    ipcRenderer.invoke('update-project-reasoning-config', projectId, config),

  exportSkills: (skillIds?: string[]) =>
    ipcRenderer.invoke('export-skills', skillIds),

  importSkills: () =>
    ipcRenderer.invoke('import-skills'),

  importSkillsConfirm: (skills: WritingSkill[]) =>
    ipcRenderer.invoke('import-skills-confirm', skills),

  // Reasoning Chains
  getReasoningChains: () =>
    ipcRenderer.invoke('get-reasoning-chains'),

  saveReasoningChain: (chain: ReasoningChain) =>
    ipcRenderer.invoke('save-reasoning-chain', chain),

  deleteReasoningChain: (id: string) =>
    ipcRenderer.invoke('delete-reasoning-chain', id),

  // Continuation
  generateContinuation: (chapterId: string, cursorPosition: number, content: string) =>
    ipcRenderer.invoke('generate-continuation', chapterId, cursorPosition, content),

  // Dialogue
  dialogueSend: (level: DialogueLevel, entityId: string, messages: { role: 'user' | 'assistant'; content: string }[]) =>
    ipcRenderer.invoke('dialogue:send', level, entityId, messages),

  dialogueCancel: (streamId: string) =>
    ipcRenderer.invoke('dialogue:cancel', streamId),

  getConversation: (level: DialogueLevel, entityId: string) =>
    ipcRenderer.invoke('get-conversation', level, entityId),

  saveConversation: (conversation: Conversation) =>
    ipcRenderer.invoke('save-conversation', conversation),

  deleteConversation: (level: DialogueLevel, entityId: string) =>
    ipcRenderer.invoke('delete-conversation', level, entityId),

  onDialogueChunk: (callback: (data: DialogueStreamChunk) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueStreamChunk) => callback(data)
    ipcRenderer.on('dialogue:chunk', handler)
    return () => { ipcRenderer.removeListener('dialogue:chunk', handler) }
  },

  onDialogueDone: (callback: (data: DialogueStreamDone) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueStreamDone) => callback(data)
    ipcRenderer.on('dialogue:done', handler)
    return () => { ipcRenderer.removeListener('dialogue:done', handler) }
  },

  onDialogueError: (callback: (data: DialogueStreamError) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueStreamError) => callback(data)
    ipcRenderer.on('dialogue:error', handler)
    return () => { ipcRenderer.removeListener('dialogue:error', handler) }
  },

  onDialogueToolStart: (callback: (data: DialogueToolStart) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueToolStart) => callback(data)
    ipcRenderer.on('dialogue:tool-start', handler)
    return () => { ipcRenderer.removeListener('dialogue:tool-start', handler) }
  },

  onDialogueToolDone: (callback: (data: DialogueToolDone) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueToolDone) => callback(data)
    ipcRenderer.on('dialogue:tool-done', handler)
    return () => { ipcRenderer.removeListener('dialogue:tool-done', handler) }
  },

  onDialogueToolApproval: (callback: (data: DialogueToolApproval) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueToolApproval) => callback(data)
    ipcRenderer.on('dialogue:tool-approval', handler)
    return () => { ipcRenderer.removeListener('dialogue:tool-approval', handler) }
  },

  onDialogueThinkingChunk: (callback: (data: DialogueThinkingChunk) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueThinkingChunk) => callback(data)
    ipcRenderer.on('dialogue:thinking-chunk', handler)
    return () => { ipcRenderer.removeListener('dialogue:thinking-chunk', handler) }
  },

  onDialogueThinkingDone: (callback: (data: DialogueThinkingDone) => void) => {
    const handler = (_event: IpcRendererEvent, data: DialogueThinkingDone) => callback(data)
    ipcRenderer.on('dialogue:thinking-done', handler)
    return () => { ipcRenderer.removeListener('dialogue:thinking-done', handler) }
  },

  dialogueApproveTool: (response: DialogueToolApprovalResponse) =>
    ipcRenderer.invoke('dialogue:approve-tool', response),

  resolveDialogueContextWindow: () =>
    ipcRenderer.invoke('dialogue:resolve-context-window'),

  dialogueCompress: (level: DialogueLevel, entityId: string) =>
    ipcRenderer.invoke('dialogue:compress', level, entityId),

  // Reasoning
  onReasoningStart: (callback: (data: ReasoningStartEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: ReasoningStartEvent) => callback(data)
    ipcRenderer.on('dialogue:reasoning-start', handler)
    return () => { ipcRenderer.removeListener('dialogue:reasoning-start', handler) }
  },

  onReasoningStepStart: (callback: (data: ReasoningStepStartEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: ReasoningStepStartEvent) => callback(data)
    ipcRenderer.on('dialogue:reasoning-step-start', handler)
    return () => { ipcRenderer.removeListener('dialogue:reasoning-step-start', handler) }
  },

  onReasoningStepDone: (callback: (data: ReasoningStepDoneEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: ReasoningStepDoneEvent) => callback(data)
    ipcRenderer.on('dialogue:reasoning-step-done', handler)
    return () => { ipcRenderer.removeListener('dialogue:reasoning-step-done', handler) }
  },

  onReasoningStepError: (callback: (data: ReasoningStepErrorEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: ReasoningStepErrorEvent) => callback(data)
    ipcRenderer.on('dialogue:reasoning-step-error', handler)
    return () => { ipcRenderer.removeListener('dialogue:reasoning-step-error', handler) }
  },

  onReasoningDone: (callback: (data: ReasoningDoneEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: ReasoningDoneEvent) => callback(data)
    ipcRenderer.on('dialogue:reasoning-done', handler)
    return () => { ipcRenderer.removeListener('dialogue:reasoning-done', handler) }
  },

  // AI Thinking (通用)
  onAIThinkingChunk: (callback: (data: AIThinkingChunk) => void) => {
    const handler = (_event: IpcRendererEvent, data: AIThinkingChunk) => callback(data)
    ipcRenderer.on('ai:thinking-chunk', handler)
    return () => { ipcRenderer.removeListener('ai:thinking-chunk', handler) }
  },

  onAIThinkingDone: (callback: (data: AIThinkingDone) => void) => {
    const handler = (_event: IpcRendererEvent, data: AIThinkingDone) => callback(data)
    ipcRenderer.on('ai:thinking-done', handler)
    return () => { ipcRenderer.removeListener('ai:thinking-done', handler) }
  },

  aiCancel: () =>
    ipcRenderer.invoke('ai:cancel'),

  // 批量摘要事件
  onSummaryBatchProgress: (callback: (data: SummaryBatchProgressEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: SummaryBatchProgressEvent) => callback(data)
    ipcRenderer.on('summary-batch:progress', handler)
    return () => { ipcRenderer.removeListener('summary-batch:progress', handler) }
  },

  onSummaryBatchDone: (callback: (data: SummaryBatchDoneEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: SummaryBatchDoneEvent) => callback(data)
    ipcRenderer.on('summary-batch:done', handler)
    return () => { ipcRenderer.removeListener('summary-batch:done', handler) }
  },

  onSummaryBatchError: (callback: (data: SummaryBatchErrorEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: SummaryBatchErrorEvent) => callback(data)
    ipcRenderer.on('summary-batch:error', handler)
    return () => { ipcRenderer.removeListener('summary-batch:error', handler) }
  },

  // Outlines
  getOutline: (level: DialogueLevel, entityId: string) =>
    ipcRenderer.invoke('get-outline', level, entityId),

  saveOutline: (outline: Outline) =>
    ipcRenderer.invoke('save-outline', outline),

  deleteOutline: (level: DialogueLevel, entityId: string) =>
    ipcRenderer.invoke('delete-outline', level, entityId),

  // Update
  checkForUpdates: () =>
    ipcRenderer.invoke('update:check'),

  downloadUpdate: () =>
    ipcRenderer.invoke('update:download'),

  downloadFromGitee: () =>
    ipcRenderer.invoke('update:download-gitee'),

  cancelGiteeDownload: () =>
    ipcRenderer.invoke('update:cancel-gitee'),

  installGiteeUpdate: () =>
    ipcRenderer.invoke('update:install-gitee'),

  installUpdate: () =>
    ipcRenderer.invoke('update:install'),

  getUpdateStatus: () =>
    ipcRenderer.invoke('update:get-status'),

  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: IpcRendererEvent, status: UpdateStatus) => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => { ipcRenderer.removeListener('update:status', handler) }
  },

  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  // Visual Effects
  selectBackgroundImage: () =>
    ipcRenderer.invoke('visual:select-background'),

  detectSteamPath: () =>
    ipcRenderer.invoke('visual:detect-steam'),

  selectFolder: () =>
    ipcRenderer.invoke('visual:select-folder'),

  scanWallpapers: (path: string) =>
    ipcRenderer.invoke('visual:scan-wallpapers', path),

  prepareWallpaper: (filePath: string) =>
    ipcRenderer.invoke('visual:prepare-wallpaper', filePath),

  // Agent (Writer Agent System)
  agentProcess: (level: DialogueLevel, entityId: string, userRequest: string) =>
    ipcRenderer.invoke('agent:process', level, entityId, userRequest),

  agentCancel: () =>
    ipcRenderer.invoke('agent:cancel'),

  agentGetState: () =>
    ipcRenderer.invoke('agent:get-state'),

  agentRoute: (level: DialogueLevel, entityId: string, input: string) =>
    ipcRenderer.invoke('agent:route', level, entityId, input),

  agentApproveRewrite: (approvalId: string, approved: boolean) =>
    ipcRenderer.invoke('agent:approve-rewrite', approvalId, approved),

  onAgentRewriteApproval: (callback: (data: AgentRewriteApprovalEvent) => void) => {
    const handler = (_event: IpcRendererEvent, data: AgentRewriteApprovalEvent) => callback(data)
    ipcRenderer.on('agent:rewrite-approval', handler)
    return () => { ipcRenderer.removeListener('agent:rewrite-approval', handler) }
  },

  onAgentPhaseChange: (callback: (data: AgentPhaseChange) => void) => {
    const handler = (_event: IpcRendererEvent, data: AgentPhaseChange) => callback(data)
    ipcRenderer.on('agent:phase-change', handler)
    return () => { ipcRenderer.removeListener('agent:phase-change', handler) }
  },

  onAgentSubTaskUpdate: (callback: (data: AgentSubTaskUpdate) => void) => {
    const handler = (_event: IpcRendererEvent, data: AgentSubTaskUpdate) => callback(data)
    ipcRenderer.on('agent:subtask-update', handler)
    return () => { ipcRenderer.removeListener('agent:subtask-update', handler) }
  },

  onAgentCriticResult: (callback: (data: AgentCriticResult) => void) => {
    const handler = (_event: IpcRendererEvent, data: AgentCriticResult) => callback(data)
    ipcRenderer.on('agent:critic-result', handler)
    return () => { ipcRenderer.removeListener('agent:critic-result', handler) }
  },

  onAgentTaskComplete: (callback: (data: AgentTaskComplete) => void) => {
    const handler = (_event: IpcRendererEvent, data: AgentTaskComplete) => callback(data)
    ipcRenderer.on('agent:task-complete', handler)
    return () => { ipcRenderer.removeListener('agent:task-complete', handler) }
  },

  onAgentChunk: (callback: (data: { streamId: string; chunk: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string; chunk: string }) => callback(data)
    ipcRenderer.on('agent:chunk', handler)
    return () => { ipcRenderer.removeListener('agent:chunk', handler) }
  },

  onAgentThinkingChunk: (callback: (data: { streamId: string; chunk: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string; chunk: string }) => callback(data)
    ipcRenderer.on('agent:thinking-chunk', handler)
    return () => { ipcRenderer.removeListener('agent:thinking-chunk', handler) }
  },

  onAgentThinkingDone: (callback: (data: { streamId: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { streamId: string }) => callback(data)
    ipcRenderer.on('agent:thinking-done', handler)
    return () => { ipcRenderer.removeListener('agent:thinking-done', handler) }
  },

  onAgentFlowUpdate: (callback: (data: AgentFlowSnapshot) => void) => {
    const handler = (_event: IpcRendererEvent, data: AgentFlowSnapshot) => callback(data)
    ipcRenderer.on('agent:flow-update', handler)
    return () => { ipcRenderer.removeListener('agent:flow-update', handler) }
  },

  onAgentTrajectory: (callback: (data: WritingTrajectory) => void) => {
    const handler = (_event: IpcRendererEvent, data: WritingTrajectory) => callback(data)
    ipcRenderer.on('agent:trajectory', handler)
    return () => { ipcRenderer.removeListener('agent:trajectory', handler) }
  },

  // Memory
  memoryGetContext: (projectId: string) =>
    ipcRenderer.invoke('memory:get-context', projectId),

  memoryGetSummary: (projectId: string) =>
    ipcRenderer.invoke('memory:get-summary', projectId),

  memoryClear: (projectId: string, layer: 'episodic' | 'semantic' | 'style' | 'dialogue' | 'all') =>
    ipcRenderer.invoke('memory:clear', projectId, layer)
}

contextBridge.exposeInMainWorld('api', api)
