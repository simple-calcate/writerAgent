import { autoUpdater } from 'electron-updater'
import { BrowserWindow, app } from 'electron'
import type { UpdateStatus } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let currentStatus: UpdateStatus = { status: 'idle' }
let isPortable = false
let checkTimeout: ReturnType<typeof setTimeout> | null = null

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Detect portable mode (running from non-installed exe)
  isPortable = !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR !== undefined

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

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
