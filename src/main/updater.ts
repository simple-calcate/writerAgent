import { autoUpdater } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import type { UpdateStatus } from '../shared/types'

const GITEE_RELEASES_API = 'https://gitee.com/api/v5/repos/simple-calcate/writerAgent/releases/latest'

let mainWindow: BrowserWindow | null = null
let currentStatus: UpdateStatus = { status: 'idle' }
let isPortable = false
let checkTimeout: ReturnType<typeof setTimeout> | null = null
let giteeDownloadAbort: AbortController | null = null

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Detect portable mode (running from non-installed exe)
  isPortable = !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR !== undefined

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = true  // 允许检测预览版更新

  // Disable logger to reduce noise
  autoUpdater.logger = null

  autoUpdater.on('checking-for-update', () => {
    currentStatus = { status: 'checking' }
    sendStatus()
  })

  autoUpdater.on('update-available', (info) => {
    clearCheckTimeout()
    currentStatus = {
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    }
    sendStatus()
  })

  autoUpdater.on('update-not-available', () => {
    clearCheckTimeout()
    currentStatus = { status: 'not-available' }
    sendStatus()
  })

  autoUpdater.on('download-progress', (progress) => {
    currentStatus = {
      status: 'downloading',
      version: currentStatus.version,
      progress: {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total
      }
    }
    sendStatus()
  })

  autoUpdater.on('update-downloaded', () => {
    currentStatus = {
      status: 'downloaded',
      version: currentStatus.version
    }
    sendStatus()
  })

  autoUpdater.on('error', (err) => {
    clearCheckTimeout()
    currentStatus = {
      status: 'error',
      error: err.message
    }
    sendStatus()
  })
}

function clearCheckTimeout(): void {
  if (checkTimeout) {
    clearTimeout(checkTimeout)
    checkTimeout = null
  }
}

function sendStatus(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', currentStatus)
  }
}

export function getUpdateStatus(): UpdateStatus {
  return { ...currentStatus }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  // Dev mode: electron-updater doesn't work properly without packaging
  if (!app.isPackaged) {
    currentStatus = { status: 'error', error: '开发模式下无法检查更新，请打包后测试' }
    sendStatus()
    return getUpdateStatus()
  }

  clearCheckTimeout()

  // Timeout: if no event fires within 15s, show error
  checkTimeout = setTimeout(() => {
    if (currentStatus.status === 'checking') {
      currentStatus = { status: 'error', error: '检查超时，请检查网络连接后重试' }
      sendStatus()
    }
  }, 15000)

  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    clearCheckTimeout()
    currentStatus = { status: 'error', error: err.message }
    sendStatus()
  }
  return getUpdateStatus()
}

export async function downloadUpdate(): Promise<void> {
  if (currentStatus.status !== 'available') return
  await autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  if (currentStatus.status !== 'downloaded') return
  autoUpdater.quitAndInstall(false, true)
}

export function getIsPortable(): boolean {
  return isPortable
}

export async function downloadFromGitee(): Promise<void> {
  // Allow download from 'available' or 'error' states
  if (currentStatus.status !== 'available' && currentStatus.status !== 'error') return

  giteeDownloadAbort = new AbortController()

  // Show immediate feedback
  currentStatus = { status: 'checking' }
  sendStatus()

  try {
    // Fetch latest release info from Gitee
    const res = await fetch(GITEE_RELEASES_API, { signal: giteeDownloadAbort.signal })
    if (!res.ok) throw new Error(`Gitee API 返回 ${res.status}`)
    const release = await res.json() as any

    // Find Setup exe
    const asset = release.assets?.find((a: any) =>
      a.name?.includes('Setup') && a.name?.endsWith('.exe')
    )
    if (!asset) throw new Error('未找到安装包')

    const downloadUrl = asset.browser_download_url
    const version = release.tag_name?.replace('v', '') || currentStatus.version

    currentStatus = { status: 'downloading', version }
    sendStatus()

    // Download file
    const downloadRes = await fetch(downloadUrl, { signal: giteeDownloadAbort.signal })
    if (!downloadRes.ok) throw new Error(`下载失败: ${downloadRes.status}`)

    const total = Number(downloadRes.headers.get('content-length')) || 0
    let transferred = 0

    const tempDir = join(app.getPath('temp'), 'novel-writer-update')
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
    const filePath = join(tempDir, asset.name)

    const fileStream = createWriteStream(filePath)
    const reader = downloadRes.body?.getReader()
    if (!reader) throw new Error('无法读取下载流')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      fileStream.write(value)
      transferred += value.length
      if (total > 0) {
        currentStatus = {
          status: 'downloading',
          version,
          progress: { percent: Math.round((transferred / total) * 100), transferred, total }
        }
        sendStatus()
      }
    }

    fileStream.end()
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', resolve)
      fileStream.on('error', reject)
    })

    currentStatus = { status: 'downloaded', version, giteeInstallerPath: filePath }
    sendStatus()
  } catch (err: any) {
    if (err.name === 'AbortError') return
    currentStatus = { status: 'error', error: `Gitee 下载失败: ${err.message}` }
    sendStatus()
  }
}

export function cancelGiteeDownload(): void {
  if (giteeDownloadAbort) {
    giteeDownloadAbort.abort()
    giteeDownloadAbort = null
  }
}

export function installGiteeUpdate(): void {
  if (currentStatus.status !== 'downloaded' || !currentStatus.giteeInstallerPath) return
  const { spawn } = require('child_process')
  const child = spawn('cmd', ['/c', 'start', '', currentStatus.giteeInstallerPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  })
  child.unref()
  app.quit()
}
