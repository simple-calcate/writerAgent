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

  summarizeChapter: (content: string) =>
    ipcRenderer.invoke('summarize-chapter', content)
}

contextBridge.exposeInMainWorld('api', api)
