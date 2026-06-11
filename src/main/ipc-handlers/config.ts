import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { getLLMConfig, saveLLMConfig, getDataPath, getDataPathDefault, setDataPath, openDataFolder } from '../store/db'
import { diagnoseLocalModel } from '../llm/client'
import { checkForUpdates, downloadUpdate, downloadFromGitee, cancelGiteeDownload, installGiteeUpdate, installUpdate, getUpdateStatus } from '../updater'

export function registerConfigHandlers(mainWindow: BrowserWindow): void {
  // Config
  ipcMain.handle('get-llm-config', () => getLLMConfig())
  ipcMain.handle('save-llm-config', (_e, config) => saveLLMConfig(config))
  ipcMain.handle('diagnose-local-model', async (_e, config) => {
    return diagnoseLocalModel(config)
  })

  // Data path
  ipcMain.handle('get-data-path', () => getDataPath())
  ipcMain.handle('get-data-path-default', () => getDataPathDefault())
  ipcMain.handle('set-data-path', (_e, newPath: string) => setDataPath(newPath))
  ipcMain.handle('open-data-folder', () => openDataFolder())
  ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url))

  // Update
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:download-gitee', () => downloadFromGitee())
  ipcMain.handle('update:cancel-gitee', () => cancelGiteeDownload())
  ipcMain.handle('update:install-gitee', () => installGiteeUpdate())
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
    const { existsSync, readdirSync, readFileSync, statSync } = require('fs')
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
          let previewDataUrl: string | undefined
          if (previewFile) {
            try {
              const previewPath = join(dirPath, previewFile)
              const stat = statSync(previewPath)
              if (stat.size <= 2 * 1024 * 1024) {
                const buffer = readFileSync(previewPath)
                const ext = previewFile.split('.').pop()?.toLowerCase() || 'jpg'
                const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
                previewDataUrl = `data:${mime};base64,${buffer.toString('base64')}`
              }
            } catch {}
          }
          wallpapers.push({
            id: dir.name,
            name: projectName,
            file: join(dirPath, mediaFile),
            type: projectType,
            preview: previewDataUrl
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
