import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDB } from './store/db'
import { initUpdater, checkForUpdates } from './updater'
import { registerAIHandlers } from './ipc-handlers/ai'
import { registerDataHandlers } from './ipc-handlers/data'
import { registerConfigHandlers } from './ipc-handlers/config'

let mainWindow: BrowserWindow | null = null
const currentAIAbort: { controller: AbortController | null } = { controller: null }

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false, // Don't show until ready
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

  // Show window when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
}

function registerIPC(): void {
  if (!mainWindow) return
  registerAIHandlers(mainWindow, currentAIAbort, (ctrl) => { currentAIAbort.controller = ctrl })
  registerDataHandlers(mainWindow)
  registerConfigHandlers(mainWindow)
}

app.whenReady().then(() => {
  initDB()
  createWindow()
  registerIPC()

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
