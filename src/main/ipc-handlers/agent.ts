import { BrowserWindow, ipcMain } from 'electron'
import { getProjects, getVolumes, getChapters, resolveFeatureConfig } from '../store/db'
import { getAgentRuntime } from '../agent/runtime'
import { handleRewriteApprovalResponse } from '../agent/wac-helpers'
import { log } from '../utils/logger'
import type { DialogueLevel, Volume, Chapter } from '../../shared/types'

export function registerAgentHandlers(mainWindow: BrowserWindow): void {
  const runtime = getAgentRuntime(mainWindow)

  ipcMain.handle('agent:process', async (_e, level: DialogueLevel, entityId: string, userRequest: string) => {
    const projects = getProjects()
    const project = projects.find(p => {
      if (level === 'book') return p.id === entityId
      if (level === 'volume') {
        const volumes = getVolumes(p.id)
        return volumes.some(v => v.id === entityId)
      }
      const chapters = getChapters(p.id)
      return chapters.some(c => c.id === entityId)
    })
    if (!project) throw new Error('找不到对应的项目')

    const allVolumes = getVolumes(project.id)
    const allChapters = getChapters(project.id)

    let volume: Volume | null = null
    let chapter: Chapter | null = null

    if (level === 'volume') {
      volume = allVolumes.find(v => v.id === entityId) || null
    } else if (level === 'chapter') {
      chapter = allChapters.find(c => c.id === entityId) || null
      if (chapter && chapter.volumeId) {
        volume = allVolumes.find(v => v.id === chapter!.volumeId) || null
      }
    }

    const streamId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // 异步执行，不阻塞 IPC
    runtime.processRequest(userRequest, project, volume, chapter, level, streamId)
      .catch(err => {
        if (err.message !== '任务已取消') {
          log.error('[Agent] 执行失败:', err)
          mainWindow.webContents.send('agent:error', { streamId, error: err.message })
        }
      })

    return { streamId }
  })

  ipcMain.handle('agent:cancel', () => {
    runtime.cancel()
  })

  ipcMain.handle('agent:get-state', () => {
    return runtime.getState()
  })

  ipcMain.handle('agent:route', async (_e, level: DialogueLevel, entityId: string, input: string) => {
    const projects = getProjects()
    const project = projects.find(p => {
      if (level === 'book') return p.id === entityId
      if (level === 'volume') {
        const volumes = getVolumes(p.id)
        return volumes.some(v => v.id === entityId)
      }
      const chapters = getChapters(p.id)
      return chapters.some(c => c.id === entityId)
    })
    if (!project) throw new Error('找不到对应的项目')

    const allVolumes = getVolumes(project.id)

    let volume: Volume | null = null
    let chapter: Chapter | null = null

    if (level === 'volume') {
      volume = allVolumes.find(v => v.id === entityId) || null
    } else if (level === 'chapter') {
      const allChapters = getChapters(project.id)
      chapter = allChapters.find(c => c.id === entityId) || null
      if (chapter && chapter.volumeId) {
        volume = allVolumes.find(v => v.id === chapter!.volumeId) || null
      }
    }

    const config = resolveFeatureConfig('dialogue')
    if (!config) throw new Error('对话功能未启用')
    if (!config.apiKey) throw new Error('请先配置 API Key')

    return runtime.route(input, project, volume, chapter, level, config)
  })

  ipcMain.handle('agent:approve-rewrite', (_e, approvalId: string, approved: boolean) => {
    handleRewriteApprovalResponse(approvalId, approved)
  })
}
