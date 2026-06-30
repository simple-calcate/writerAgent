import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { getProjects, createProject, renameProject, deleteProject, updateProjectAIConfig, updateProjectEnabledSkills, updateProjectFeatureSkillIds, updateProjectReasoningConfig, getVolumes, createVolume, renameVolume, updateVolume, deleteVolume, getChapters, createChapter, renameChapter, updateChapter, deleteChapter, updateChapterSummary, getVersions, saveVersion, deleteVersion, getOutline, saveOutline, deleteOutline, getSkills, saveSkill, deleteSkill, saveSkills, saveReasoningChain, deleteReasoningChain } from '../store/db'
import { getReasoningChains } from '../llm/reasoning-chains'
import { parseTxtContent } from '../import-parser'
import type { ExportOptions, BookAIConfig, DialogueLevel, WritingSkill, ReasoningChain } from '../../shared/types'
import { randomUUID } from 'crypto'

export function registerDataHandlers(mainWindow: BrowserWindow): void {
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
  ipcMain.handle('update-chapter-summary', (_e, chapterId: string, summary: string | null, contentHash?: string | null) => updateChapterSummary(chapterId, summary, contentHash))

  // Versions
  ipcMain.handle('get-versions', (_e, chapterId: string) => getVersions(chapterId))
  ipcMain.handle('save-version', (_e, chapterId: string, version) => saveVersion(chapterId, version))
  ipcMain.handle('delete-version', (_e, chapterId: string, index: number) => deleteVersion(chapterId, index))

  // Export
  ipcMain.handle('export-files', async (_e, options: ExportOptions) => {
    const { projectName, chapters, format, mode } = options
    const ext = format === 'md' ? '.md' : '.txt'

    // 过滤注释行（// 开头的行）
    const filterComments = (text: string) =>
      text.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')

    if (mode === 'merged') {
      const result = await dialog.showSaveDialog(mainWindow, {
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
      const result = await dialog.showOpenDialog(mainWindow, {
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
    const result = await dialog.showOpenDialog(mainWindow, {
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

  ipcMain.handle('update-project-reasoning-config', (_e, projectId: string, config: any) => {
    updateProjectReasoningConfig(projectId, config)
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

    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出技能库',
      defaultPath: join(app.getPath('desktop'), 'writing-skills.json'),
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    return true
  })

  ipcMain.handle('import-skills', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
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

  // Reasoning Chains
  ipcMain.handle('get-reasoning-chains', () => getReasoningChains())

  ipcMain.handle('save-reasoning-chain', (_e, chain: ReasoningChain) => {
    saveReasoningChain(chain)
  })

  ipcMain.handle('delete-reasoning-chain', (_e, id: string) => {
    deleteReasoningChain(id)
  })
}
