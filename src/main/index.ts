import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { initDB, getProjects, createProject, renameProject, deleteProject, updateProjectAIConfig, getVolumes, createVolume, renameVolume, updateVolume, deleteVolume, getChapters, createChapter, renameChapter, updateChapter, deleteChapter, updateChapterSummary, getVersions, saveVersion, deleteVersion, getLLMConfig, saveLLMConfig, resolveFeatureConfig, getDefaultProfile, getDataPath, getDataPathDefault, setDataPath, openDataFolder, resolveAIConfig, getConversation, saveConversation, deleteConversation, getOutline, saveOutline, deleteOutline } from './store/db'
import { autoPolish, polishText, summarizeChapter } from './llm/client'
import { refineSummary } from './llm/refine-summary'
import { startDialogueStream, cancelDialogueStream, handleApprovalResponse } from './llm/dialogue'
import { parseTxtContent } from './import-parser'
import { generateContinuation } from './llm/continuation'
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

    // 过滤注释行（// 开头的行）
    const filterComments = (text: string) =>
      text.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')

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
          return header + filterComments(ch.content)
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
        writeFileSync(join(exportDir, `${prefix}_${safeTitle}${ext}`), header + filterComments(ch.content), 'utf-8')
      }
      return true
    }
  })

  // Import
  ipcMain.handle('import-book-preview', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择要导入的 .txt 文件',
      filters: [{ name: '文本文件', extensions: ['txt'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null

    const filePath = result.filePaths[0]
    const content = readFileSync(filePath, 'utf-8')
    const chapters = parseTxtContent(content)
    if (chapters.length === 0) return null

    // 从文件名提取书名
    const fileName = filePath.split(/[/\\]/).pop() || '导入书籍'
    const bookName = fileName.replace(/\.txt$/i, '')
    const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0)

    return { bookName, chapters, totalChars }
  })

  ipcMain.handle('import-book-confirm', async (_e, bookName: string, chapters: { title: string; content: string }[]) => {
    const project = createProject(bookName)
    const volume = createVolume(project.id, '第一卷')

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i]
      const chapter = createChapter(project.id, ch.title, volume.id)
      if (chapter) {
        updateChapter(chapter.id, { content: ch.content })
      }
    }

    return { project, volume, chapterCount: chapters.length }
  })

  // Continuation
  ipcMain.handle('generate-continuation', async (_e, chapterId: string, cursorPosition: number, content: string) => {
    const config = resolveFeatureConfig('dialogue')
    if (!config || !config.apiKey) return null

    const allProjects = getProjects()
    let chapter = null
    let projectId = ''
    for (const p of allProjects) {
      const chs = getChapters(p.id)
      const found = chs.find(c => c.id === chapterId)
      if (found) { chapter = found; projectId = p.id; break }
    }
    if (!chapter) return null

    const aiConfig = resolveAIConfig(projectId, chapter.volumeId || undefined)
    const chapterOutline = getOutline('chapter', chapterId)
    const volumeOutline = chapter.volumeId ? getOutline('volume', chapter.volumeId) : null
    const bookOutline = getOutline('book', projectId)

    // 没有任何大纲时不触发续写
    if (!chapterOutline && !volumeOutline && !bookOutline) return null

    return generateContinuation(config, {
      content,
      cursorPosition,
      chapterOutline: chapterOutline?.content,
      volumeOutline: volumeOutline?.content,
      bookOutline: bookOutline?.content,
      aiConfig
    })
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
