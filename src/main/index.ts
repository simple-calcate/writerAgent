import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { initDB, getProjects, createProject, renameProject, deleteProject, updateProjectAIConfig, updateProjectEnabledSkills, updateProjectFeatureSkillIds, getVolumes, createVolume, renameVolume, updateVolume, deleteVolume, getChapters, createChapter, renameChapter, updateChapter, deleteChapter, updateChapterSummary, getVersions, saveVersion, deleteVersion, getLLMConfig, saveLLMConfig, resolveFeatureConfig, getDefaultProfile, getDataPath, getDataPathDefault, setDataPath, openDataFolder, resolveAIConfig, getConversation, saveConversation, deleteConversation, getOutline, saveOutline, deleteOutline, getSkills, saveSkill, deleteSkill, saveSkills } from './store/db'
import { autoPolish, polishText, summarizeChapter } from './llm/client'
import { refineSummary } from './llm/refine-summary'
import { startDialogueStream, cancelDialogueStream, handleApprovalResponse } from './llm/dialogue'
import { parseTxtContent } from './import-parser'
import { generateContinuation } from './llm/continuation'
import { initUpdater, checkForUpdates, downloadUpdate, installUpdate, getUpdateStatus } from './updater'
import type { ExportOptions, BookAIConfig, DialogueLevel, DialogueToolApprovalResponse, WritingSkill } from '../shared/types'
import { randomUUID } from 'crypto'

let mainWindow: BrowserWindow | null = null
let currentAIAbort: AbortController | null = null

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
  // AI Cancel
  ipcMain.handle('ai:cancel', () => {
    if (currentAIAbort) {
      currentAIAbort.abort()
      currentAIAbort = null
    }
  })

  // AI
  ipcMain.handle('auto-polish', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('polish')
    console.log('[auto-polish] config:', config ? { model: config.model, baseUrl: config.baseUrl } : null)
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    console.log('[auto-polish] content length:', content.length)
    currentAIAbort = new AbortController()
    try {
      const result = await autoPolish(config, content, aiConfig, mainWindow!, currentAIAbort.signal)
      console.log('[auto-polish] result suggestions:', result.suggestions.length)
      return result
    } finally {
      currentAIAbort = null
    }
  })

  ipcMain.handle('polish-text', async (_e, original: string, context: string) => {
    const config = resolveFeatureConfig('polish')
    if (!config) throw new Error('润色功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return polishText(config, original, context, mainWindow!)
  })

  ipcMain.handle('summarize-chapter', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('summary')
    if (!config) throw new Error('摘要功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    currentAIAbort = new AbortController()
    try {
      return await summarizeChapter(config, content, aiConfig, mainWindow!, currentAIAbort.signal)
    } finally {
      currentAIAbort = null
    }
  })

  ipcMain.handle('refine-summary', async (_e, content: string, aiConfig?: Partial<BookAIConfig>) => {
    const config = resolveFeatureConfig('refineSummary')
    if (!config) throw new Error('精炼总结功能未启用，请在设置中开启')
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    currentAIAbort = new AbortController()
    try {
      return await refineSummary(config, content, aiConfig, mainWindow!, currentAIAbort.signal)
    } finally {
      currentAIAbort = null
    }
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
  ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url))

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

    // Get enabled skills (continuation feature)
    const project = allProjects.find(p => p.id === projectId)
    const allSkills = getSkills()
    const skillIds = project?.featureSkillIds?.continuation || project?.enabledSkillIds || []
    const enabledSkills = skillIds.length > 0
      ? allSkills.filter(s => skillIds.includes(s.id))
      : []

    return generateContinuation(config, {
      content,
      cursorPosition,
      chapterOutline: chapterOutline?.content,
      volumeOutline: volumeOutline?.content,
      bookOutline: bookOutline?.content,
      aiConfig,
      skills: enabledSkills,
      mainWindow: mainWindow!
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

  // Skills
  ipcMain.handle('get-skills', () => getSkills())

  ipcMain.handle('save-skill', (_e, skill: WritingSkill) => {
    saveSkill(skill)
  })

  ipcMain.handle('delete-skill', (_e, id: string) => {
    deleteSkill(id)
  })

  ipcMain.handle('update-project-enabled-skills', (_e, projectId: string, skillIds: string[]) => {
    updateProjectEnabledSkills(projectId, skillIds)
  })

  ipcMain.handle('update-project-feature-skill-ids', (_e, projectId: string, featureSkillIds: any) => {
    updateProjectFeatureSkillIds(projectId, featureSkillIds)
  })

  ipcMain.handle('export-skills', async (_e, skillIds?: string[]) => {
    const allSkills = getSkills()
    const skills = skillIds ? allSkills.filter(s => skillIds.includes(s.id)) : allSkills
    if (skills.length === 0) return false

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      skills: skills.map(({ name, category, content, source }) => ({ name, category, content, source }))
    }

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出技能库',
      defaultPath: join(app.getPath('desktop'), 'writing-skills.json'),
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    return true
  })

  ipcMain.handle('import-skills', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入技能库',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null

    try {
      const content = readFileSync(result.filePaths[0], 'utf-8')
      const data = JSON.parse(content)
      if (!data.skills || !Array.isArray(data.skills)) return null

      const now = new Date().toISOString()
      const skills: WritingSkill[] = data.skills.map((s: any) => ({
        id: randomUUID(),
        name: s.name || '未命名技能',
        category: s.category || 'custom',
        content: s.content || '',
        source: s.source,
        createdAt: now,
        updatedAt: now
      }))
      return skills
    } catch {
      return null
    }
  })

  ipcMain.handle('import-skills-confirm', (_e, skills: WritingSkill[]) => {
    saveSkills(skills)
  })

  // Update
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => installUpdate())
  ipcMain.handle('update:get-status', () => getUpdateStatus())
  ipcMain.handle('get-app-version', () => app.getVersion())

  // Visual Effects
  ipcMain.handle('visual:select-background', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择背景图片或视频',
      filters: [
        { name: '媒体文件', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'mp4', 'webm'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const isVideo = /\.(mp4|webm)$/i.test(filePath)
    const maxSize = isVideo ? 200 * 1024 * 1024 : 5 * 1024 * 1024
    const { statSync, copyFileSync } = require('fs')
    const stat = statSync(filePath)
    if (stat.size <= maxSize && !isVideo) {
      const buffer = readFileSync(filePath)
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      return `data:${mime};base64,${buffer.toString('base64')}`
    }
    const bgDir = join(app.getPath('userData'), 'backgrounds')
    mkdirSync(bgDir, { recursive: true })
    const destName = `bg-${Date.now()}-${filePath.split(/[/\\]/).pop()}`
    const dest = join(bgDir, destName)
    copyFileSync(filePath, dest)
    return dest
  })

  // Wallpaper Engine
  ipcMain.handle('visual:detect-steam', () => {
    const { execSync } = require('child_process')
    const { existsSync } = require('fs')
    // Try common Steam paths
    const candidates = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      'D:\\Steam',
      'D:\\SteamLibrary',
      'E:\\Steam',
      'E:\\SteamLibrary'
    ]
    // Try registry first
    try {
      const reg = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath 2>nul', { encoding: 'utf8' })
      const match = reg.match(/InstallPath\s+REG_SZ\s+(.+)/)
      if (match && existsSync(match[1].trim())) {
        candidates.unshift(match[1].trim())
      }
    } catch {}
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return null
  })

  ipcMain.handle('visual:select-folder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Wallpaper Engine 壁纸目录',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle('visual:scan-wallpapers', (_e, workshopPath: string) => {
    const { existsSync, readdirSync, readFileSync } = require('fs')
    const wallpapers: Array<{ id: string; name: string; file: string; type: string; preview?: string }> = []
    if (!existsSync(workshopPath)) return wallpapers
    try {
      const dirs = readdirSync(workshopPath, { withFileTypes: true })
        .filter((d: any) => d.isDirectory())
      for (const dir of dirs) {
        const dirPath = join(workshopPath, dir.name)
        const projectFile = join(dirPath, 'project.json')
        let projectName = dir.name
        let projectType = 'unknown'
        if (existsSync(projectFile)) {
          try {
            const meta = JSON.parse(readFileSync(projectFile, 'utf8'))
            projectName = meta.title || meta.name || dir.name
            projectType = meta.type || 'unknown'
          } catch {}
        }
        const files = readdirSync(dirPath)
        const mediaFile = files.find((f: string) => /\.(mp4|webm|jpg|jpeg|png|gif|webp)$/i.test(f))
        if (mediaFile) {
          const previewFile = files.find((f: string) => /^preview\.(jpg|jpeg|png|gif|webp)$/i.test(f))
          wallpapers.push({
            id: dir.name,
            name: projectName,
            file: join(dirPath, mediaFile),
            type: projectType,
            preview: previewFile ? join(dirPath, previewFile) : undefined
          })
        }
      }
    } catch {}
    return wallpapers
  })

  ipcMain.handle('visual:prepare-wallpaper', (_e, filePath: string) => {
    const { existsSync, statSync, readFileSync, copyFileSync } = require('fs')
    if (!existsSync(filePath)) return null
    try {
      const isVideo = /\.(mp4|webm)$/i.test(filePath)
      if (isVideo) {
        const bgDir = join(app.getPath('userData'), 'backgrounds')
        mkdirSync(bgDir, { recursive: true })
        const destName = `wp-${Date.now()}-${filePath.split(/[/\\]/).pop()}`
        const dest = join(bgDir, destName)
        copyFileSync(filePath, dest)
        return dest
      }
      const stat = statSync(filePath)
      if (stat.size <= 5 * 1024 * 1024) {
        const buffer = readFileSync(filePath)
        const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        return `data:${mime};base64,${buffer.toString('base64')}`
      }
      const bgDir = join(app.getPath('userData'), 'backgrounds')
      mkdirSync(bgDir, { recursive: true })
      const destName = `wp-${Date.now()}-${filePath.split(/[/\\]/).pop()}`
      const dest = join(bgDir, destName)
      copyFileSync(filePath, dest)
      return dest
    } catch {
      return null
    }
  })
}

app.whenReady().then(() => {
  initDB()
  registerIPC()
  createWindow()

  if (mainWindow) {
    initUpdater(mainWindow)
    // Delay auto-check 5 seconds after window is ready (only in packaged mode)
    if (app.isPackaged) {
      mainWindow.webContents.on('did-finish-load', () => {
        setTimeout(() => { checkForUpdates() }, 5000)
      })
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
