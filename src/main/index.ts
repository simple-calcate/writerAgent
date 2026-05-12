import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { initDB, getProjects, createProject, renameProject, deleteProject, getChapters, createChapter, renameChapter, updateChapter, deleteChapter, getVersions, saveVersion, deleteVersion, getLLMConfig, saveLLMConfig, getDataPath, getDataPathDefault, setDataPath, openDataFolder } from './store/db'
import { autoPolish, polishText, summarizeChapter } from './llm/client'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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
  // Auto-polish: analyze full chapter and find weak segments
  ipcMain.handle('auto-polish', async (_e, content: string) => {
    const config = getLLMConfig()
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return autoPolish(config, content)
  })

  // Manual polish: polish a specific segment
  ipcMain.handle('polish-text', async (_e, original: string, context: string) => {
    const config = getLLMConfig()
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return polishText(config, original, context)
  })

  ipcMain.handle('summarize-chapter', async (_e, content: string) => {
    const config = getLLMConfig()
    if (!config.apiKey) throw new Error('请先在设置中配置 API Key')
    return summarizeChapter(config, content)
  })

  // Config
  ipcMain.handle('get-llm-config', () => getLLMConfig())
  ipcMain.handle('save-llm-config', (_e, config) => saveLLMConfig(config))

  // Projects
  ipcMain.handle('get-projects', () => getProjects())
  ipcMain.handle('create-project', (_e, name: string) => createProject(name))
  ipcMain.handle('rename-project', (_e, id: string, name: string) => renameProject(id, name))
  ipcMain.handle('delete-project', (_e, id: string) => deleteProject(id))

  // Chapters
  ipcMain.handle('get-chapters', (_e, projectId: string) => getChapters(projectId))
  ipcMain.handle('create-chapter', (_e, projectId: string, title: string) => createChapter(projectId, title))
  ipcMain.handle('rename-chapter', (_e, id: string, title: string) => renameChapter(id, title))
  ipcMain.handle('update-chapter', (_e, id: string, data) => updateChapter(id, data))
  ipcMain.handle('delete-chapter', (_e, id: string) => deleteChapter(id))

  // Versions
  ipcMain.handle('get-versions', (_e, chapterId: string) => getVersions(chapterId))
  ipcMain.handle('save-version', (_e, chapterId: string, version) => saveVersion(chapterId, version))
  ipcMain.handle('delete-version', (_e, chapterId: string, index: number) => deleteVersion(chapterId, index))

  // Data path
  ipcMain.handle('get-data-path', () => getDataPath())
  ipcMain.handle('get-data-path-default', () => getDataPathDefault())
  ipcMain.handle('set-data-path', (_e, newPath: string) => setDataPath(newPath))
  ipcMain.handle('open-data-folder', () => openDataFolder())
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
