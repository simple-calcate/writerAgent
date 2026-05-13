import { contextBridge, ipcRenderer } from 'electron'
import type { IPCAPI, ExportOptions, BookAIConfig } from '../shared/types'

const api: IPCAPI = {
  // AI
  autoPolish: (content: string, aiConfig?: Partial<BookAIConfig>) =>
    ipcRenderer.invoke('auto-polish', content, aiConfig),

  polishText: (original: string, context: string) =>
    ipcRenderer.invoke('polish-text', original, context),

  summarizeChapter: (content: string, aiConfig?: Partial<BookAIConfig>) =>
    ipcRenderer.invoke('summarize-chapter', content, aiConfig),

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
    ipcRenderer.invoke('export-files', options)
}

contextBridge.exposeInMainWorld('api', api)
