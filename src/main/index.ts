import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync } from 'fs'
import { initDB, getProjects, createProject, renameProject, deleteProject, updateProjectAIConfig, getVolumes, createVolume, renameVolume, updateVolume, deleteVolume, getChapters, createChapter, renameChapter, updateChapter, deleteChapter, updateChapterSummary, getVersions, saveVersion, deleteVersion, getLLMConfig, saveLLMConfig, resolveFeatureConfig, getDefaultProfile, getDataPath, getDataPathDefault, setDataPath, openDataFolder, resolveAIConfig, getConversation, saveConversation, deleteConversation, getOutline, saveOutline, deleteOutline } from './store/db'
import { autoPolish, polishText, summarizeChapter } from './llm/client'
import { refineSummary } from './llm/refine-summary'
import { startDialogueStream, cancelDialogueStream, handleApprovalResponse } from './llm/dialogue'
import type { ExportOptions, BookAIConfig, DialogueLevel, DialogueToolApprovalResponse } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: '网文写作助手'
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIPC(): void {
  // AI
  ipcMain.handle('auto-polish', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('polish')
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return autoPolish(config, content, aiConfig)
  })

  ipcMain.handle('polish-text', async (_e, original: string, context: string) => {
    const config = resolveFeatureConfig('polish')
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return polishText(config, original, context)
  })

  ipcMain.handle('summarize-chapter', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('summary')
    if (!config) throw new Error('摘要功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return summarizeChapter(config, content, aiConfig)
  })

  ipcMain.handle('refine-summary', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('refineSummary')
    if (!config) throw new Error('精炼总结功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return refineSummary(config, content, aiConfig)
  })

  // Config
  ipcMain.handle('get-llm-config', () => getLLMConfig())
  ipcMain.handle('save-llm-config', (_e, config) => saveLLMConfig(config))

  // Projects
  ipcMain.handle('get-projects', () => getProjects())
  ipcMain.handle('create-project', (_e, name: string, genre?: string | null) => createProject(name, genre))
  ipcMain.handle('rename-project', (_e, id: string, name: string) => renameProject(id, name))
  ipcMain.handle('delete-project', (_e, id: string) => deleteProject(id))
  ipcMain.handle('update-project-ai-config', (_e, projectId: string, config: Partial<BookAIConfig>) => updateProjectAIConfig(projectId, config))

  // Volumes
  ipcMain.handle('get-volumes', (_e, projectId: string) => getVolumes(projectId))
  ipcMain.handle('create-volume', (_e, projectId: string, name: string) => createVolume(projectId, name))
  ipcMain.handle('rename-volume', (_e, id: string, name: string) => renameVolume(id, name))
  ipcMain.handle('update-volume', (_e, id: string, data) => updateVolume(id, data))
  ipcMain.handle('delete-volume', (_e, id: string) => deleteVolume(id))

  // Chapters
  ipcMain.handle('get-chapters', (_e, projectId: string) => getChapters(projectId))
  ipcMain.handle('create-chapter', (_e, projectId: string, title: string, volumeId?: string | null) => createChapter(projectId, title, volumeId))
  ipcMain.handle('rename-chapter', (_e, id: string, title: string) => renameChapter(id, title))
  ipcMain.handle('update-chapter', (_e, id: string, data) => updateChapter(id, data))
  ipcMain.handle('delete-chapter', (_e, id: string) => deleteChapter(id))
  ipcMain.handle('update-chapter-summary', (_e, chapterId: string, summary: string | null) => updateChapterSummary(chapterId, summary))

  // Versions
  ipcMain.handle('get-versions', (_e, chapterId: string) => getVersions(chapterId))
  ipcMain.handle('save-version', (_e, chapterId: string, version) => saveVersion(chapterId, version))
  ipcMain.handle('delete-version', (_e, chapterId: string, index: number) => deleteVersion(chapterId, index))

  // Data path
  ipcMain.handle('get-data-path', () => getDataPath())
  ipcMain.handle('get-data-path-default', () => getDataPathDefault())
  ipcMain.handle('set-data-path', (_e, newPath: string) => setDataPath(newPath))
  ipcMain.handle('open-data-folder', () => openDataFolder())

  // Export
  ipcMain.handle('export-files', async (_e, options: ExportOptions) => {
    const { projectName, chapters, format, mode } = options
    const ext = format === 'md' ? '.md' : '.txt'

    if (mode === 'merged') {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: '导出合并文件',
        defaultPath: join(app.getPath('desktop'), `${projectName}${ext}`),
        filters: [{ name: format === 'md' ? 'Markdown' : '文本文件', extensions: [format] }]
      })
      if (result.canceled || !result.filePath) return false

      const separator = format === 'md' ? '\n\n---\n\n' : '\n\n'
      const content = chapters
        .map(ch => {
          const header = format === 'md' ? `# ${ch.title}\n\n` : `【${ch.title}】\n\n`
          return header + ch.content
        })
        .join(separator)

      writeFileSync(result.filePath, content, 'utf-8')
      return true
    } else {
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: '选择导出目录',
        properties: ['openDirectory', 'createDirectory']
      })
      if (result.canceled || !result.filePaths[0]) return false

      const dir = result.filePaths[0]
      const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_')
      const exportDir = join(dir, safeName)
      mkdirSync(exportDir, { recursive: true })

      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i]
        const prefix = String(i + 1).padStart(2, '0')
        const safeTitle = ch.title.replace(/[<>:"/\\|?*]/g, '_')
        const header = format === 'md' ? `# ${ch.title}\n\n` : ''
        writeFileSync(join(exportDir, `${prefix}_${safeTitle}${ext}`), header + ch.content, 'utf-8')
      }
      return true
    }
  })

  // Dialogue
  ipcMain.handle('dialogue:send', async (_e, level: DialogueLevel, entityId: string, messages: { role: 'user' | 'assistant'; content: string }[]) => {
    const config = resolveFeatureConfig('dialogue')
    if (!config) throw new Error('对话功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')

    // Resolve context based on level
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

    let volume = null
    let chapter = null

    if (level === 'volume') {
      volume = allVolumes.find(v => v.id === entityId) || null
    } else if (level === 'chapter') {
      chapter = allChapters.find(c => c.id === entityId) || null
      if (chapter?.volumeId) {
        volume = allVolumes.find(v => v.id === chapter.volumeId) || null
      }
    }

    return startDialogueStream({
      config,
      mainWindow: mainWindow!,
      level,
      project,
      volume,
      chapter,
      allVolumes,
      allChapters,
      aiConfig: resolveAIConfig(project, volume),
      messages
    })
  })

  ipcMain.handle('dialogue:cancel', (_e, streamId: string) => {
    cancelDialogueStream(streamId)
  })

  ipcMain.handle('get-conversation', (_e, level: DialogueLevel, entityId: string) => {
    return getConversation(level, entityId)
  })

  ipcMain.handle('save-conversation', (_e, conversation) => {
    saveConversation(conversation)
  })

  ipcMain.handle('delete-conversation', (_e, level: DialogueLevel, entityId: string) => {
    deleteConversation(level, entityId)
  })

  // Dialogue approval
  ipcMain.handle('dialogue:approve-tool', (_e, response: DialogueToolApprovalResponse) => {
    handleApprovalResponse(response)
  })

  // Outlines
  ipcMain.handle('get-outline', (_e, level: DialogueLevel, entityId: string) => {
    return getOutline(level, entityId)
  })

  ipcMain.handle('save-outline', (_e, outline) => {
    saveOutline(outline)
  })

  ipcMain.handle('delete-outline', (_e, level: DialogueLevel, entityId: string) => {
    deleteOutline(level, entityId)
  })
}

app.whenReady().then(() => {
  initDB()
  registerIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
