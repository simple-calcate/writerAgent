import { contextBridge, ipcRenderer } from 'electron'
import type { IPCAPI, ExportOptions, BookAIConfig, DialogueLevel, Conversation, DialogueStreamChunk, DialogueStreamDone, DialogueStreamError, DialogueToolStart, DialogueToolDone, DialogueToolApproval, DialogueToolApprovalResponse, DialogueThinkingChunk, DialogueThinkingDone, AIThinkingChunk, AIThinkingDone, Outline, ImportPreview, ImportConfirmResult, WritingSkill, UpdateStatus } from '../shared/types'

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

  // Config
  getLLMConfig: () =>
    ipcRenderer.invoke('get-llm-config'),

  saveLLMConfig: (config) =>
    ipcRenderer.invoke('save-llm-config', config),

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

  updateChapterSummary: (chapterId: string, summary: string | null) =>
    ipcRenderer.invoke('update-chapter-summary', chapterId, summary),

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

  updateProjectFeatureSkillIds: (projectId: string, featureSkillIds: any) =>
    ipcRenderer.invoke('update-project-feature-skill-ids', projectId, featureSkillIds),

  exportSkills: (skillIds?: string[]) =>
    ipcRenderer.invoke('export-skills', skillIds),

  importSkills: () =>
    ipcRenderer.invoke('import-skills'),

  importSkillsConfirm: (skills: WritingSkill[]) =>
    ipcRenderer.invoke('import-skills-confirm', skills),

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
    const handler = (_event: any, data: DialogueStreamChunk) => callback(data)
    ipcRenderer.on('dialogue:chunk', handler)
    return () => { ipcRenderer.removeListener('dialogue:chunk', handler) }
  },

  onDialogueDone: (callback: (data: DialogueStreamDone) => void) => {
    const handler = (_event: any, data: DialogueStreamDone) => callback(data)
    ipcRenderer.on('dialogue:done', handler)
    return () => { ipcRenderer.removeListener('dialogue:done', handler) }
  },

  onDialogueError: (callback: (data: DialogueStreamError) => void) => {
    const handler = (_event: any, data: DialogueStreamError) => callback(data)
    ipcRenderer.on('dialogue:error', handler)
    return () => { ipcRenderer.removeListener('dialogue:error', handler) }
  },

  onDialogueToolStart: (callback: (data: DialogueToolStart) => void) => {
    const handler = (_event: any, data: DialogueToolStart) => callback(data)
    ipcRenderer.on('dialogue:tool-start', handler)
    return () => { ipcRenderer.removeListener('dialogue:tool-start', handler) }
  },

  onDialogueToolDone: (callback: (data: DialogueToolDone) => void) => {
    const handler = (_event: any, data: DialogueToolDone) => callback(data)
    ipcRenderer.on('dialogue:tool-done', handler)
    return () => { ipcRenderer.removeListener('dialogue:tool-done', handler) }
  },

  onDialogueToolApproval: (callback: (data: DialogueToolApproval) => void) => {
    const handler = (_event: any, data: DialogueToolApproval) => callback(data)
    ipcRenderer.on('dialogue:tool-approval', handler)
    return () => { ipcRenderer.removeListener('dialogue:tool-approval', handler) }
  },

  onDialogueThinkingChunk: (callback: (data: DialogueThinkingChunk) => void) => {
    const handler = (_event: any, data: DialogueThinkingChunk) => callback(data)
    ipcRenderer.on('dialogue:thinking-chunk', handler)
    return () => { ipcRenderer.removeListener('dialogue:thinking-chunk', handler) }
  },

  onDialogueThinkingDone: (callback: (data: DialogueThinkingDone) => void) => {
    const handler = (_event: any, data: DialogueThinkingDone) => callback(data)
    ipcRenderer.on('dialogue:thinking-done', handler)
    return () => { ipcRenderer.removeListener('dialogue:thinking-done', handler) }
  },

  dialogueApproveTool: (response: DialogueToolApprovalResponse) =>
    ipcRenderer.invoke('dialogue:approve-tool', response),

  // AI Thinking (通用)
  onAIThinkingChunk: (callback: (data: AIThinkingChunk) => void) => {
    const handler = (_event: any, data: AIThinkingChunk) => callback(data)
    ipcRenderer.on('ai:thinking-chunk', handler)
    return () => { ipcRenderer.removeListener('ai:thinking-chunk', handler) }
  },

  onAIThinkingDone: (callback: (data: AIThinkingDone) => void) => {
    const handler = (_event: any, data: AIThinkingDone) => callback(data)
    ipcRenderer.on('ai:thinking-done', handler)
    return () => { ipcRenderer.removeListener('ai:thinking-done', handler) }
  },

  aiCancel: () =>
    ipcRenderer.invoke('ai:cancel'),

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

  installUpdate: () =>
    ipcRenderer.invoke('update:install'),

  getUpdateStatus: () =>
    ipcRenderer.invoke('update:get-status'),

  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const handler = (_event: any, status: UpdateStatus) => callback(status)
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
    ipcRenderer.invoke('visual:prepare-wallpaper', filePath)
}

contextBridge.exposeInMainWorld('api', api)
