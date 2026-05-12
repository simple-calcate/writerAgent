import { contextBridge, ipcRenderer } from 'electron'
import type { IPCAPI } from '../shared/types'

const api: IPCAPI = {
  autoPolish: (content: string) =>
    ipcRenderer.invoke('auto-polish', content),

  polishText: (original: string, context: string) =>
    ipcRenderer.invoke('polish-text', original, context),

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

  getProjects: () =>
    ipcRenderer.invoke('get-projects'),

  createProject: (name: string) =>
    ipcRenderer.invoke('create-project', name),

  renameProject: (id: string, name: string) =>
    ipcRenderer.invoke('rename-project', id, name),

  deleteProject: (id: string) =>
    ipcRenderer.invoke('delete-project', id),

  getChapters: (projectId: string) =>
    ipcRenderer.invoke('get-chapters', projectId),

  createChapter: (projectId: string, title: string) =>
    ipcRenderer.invoke('create-chapter', projectId, title),

  renameChapter: (id: string, title: string) =>
    ipcRenderer.invoke('rename-chapter', id, title),

  updateChapter: (id: string, data) =>
    ipcRenderer.invoke('update-chapter', id, data),

  deleteChapter: (id: string) =>
    ipcRenderer.invoke('delete-chapter', id),

  getVersions: (chapterId: string) =>
    ipcRenderer.invoke('get-versions', chapterId),

  saveVersion: (chapterId: string, version) =>
    ipcRenderer.invoke('save-version', chapterId, version),

  deleteVersion: (chapterId: string, index: number) =>
    ipcRenderer.invoke('delete-version', chapterId, index),

  summarizeChapter: (content: string) =>
    ipcRenderer.invoke('summarize-chapter', content)
}

contextBridge.exposeInMainWorld('api', api)
