import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DatabaseService } from './database'
import { importReplayFolder, cancelImport } from './importer'
import type { DashboardFilters } from '../shared/types'

let window: BrowserWindow | null = null
let database: DatabaseService

if (!process.env.VITE_DEV_SERVER_URL) {
  app.setPath('userData', path.join(app.getPath('appData'), 'HOTSVIZ'))
}

function createWindow(): void {
  window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const developmentUrl = process.env.VITE_DEV_SERVER_URL
  if (developmentUrl) {
    void window.loadURL(developmentUrl)
  } else {
    void window.loadFile(path.join(__dirname, '../../dist-web/index.html'))
  }
  window.on('closed', () => { window = null })
}

ipcMain.handle('replays:select-folder', async () => {
  const defaultPath = path.join(app.getPath('documents'), 'Heroes of the Storm', 'Accounts')
  const result = await dialog.showOpenDialog({
    title: 'Select the replay folder',
    properties: ['openDirectory'],
    defaultPath,
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const folderPath = result.filePaths[0]
  const replayCount = (await fs.readdir(folderPath)).filter((file) => file.toLowerCase().endsWith('.stormreplay')).length
  await database.setSetting('replayFolder', folderPath)
  return { folderPath, replayCount }
})

ipcMain.handle('replays:get-folder', async () => {
  const folderPath = await database.getSetting('replayFolder')
  if (!folderPath) return null
  try {
    const replayCount = (await fs.readdir(folderPath)).filter((file) => file.toLowerCase().endsWith('.stormreplay')).length
    return { folderPath, replayCount }
  } catch {
    return { folderPath, replayCount: 0 }
  }
})

ipcMain.handle('replays:import', async (_event, folderPath: string, clean: boolean) => importReplayFolder(folderPath, database, (progress) => {
  window?.webContents.send('replays:import-progress', progress)
}, clean))

ipcMain.handle('replays:import-cancel', () => { cancelImport() })

ipcMain.handle('dashboard:get', async (_event, filters: DashboardFilters) => database.getDashboard(filters))

ipcMain.handle('replays:list', async (_event, filters: DashboardFilters) => database.getMatches(filters))

ipcMain.handle('heatmap:get', async (_event, filters: DashboardFilters) => database.getHeatmapData(filters))

ipcMain.handle('trend:get', async (_event, filters: DashboardFilters) => database.getTrendData(filters))

ipcMain.handle('party:get', async (_event, filters: DashboardFilters) => database.getPartyData(filters))

ipcMain.handle('draft:get', async (_event, filters: DashboardFilters) => database.getDraftData(filters))

ipcMain.handle('gameModes:list', async () => database.getGameModes())

app.whenReady().then(async () => {
  database = new DatabaseService()
  await database.initialize()

  const autoCheckEnabled = (await database.getSetting('autoCheckUpdates')) !== 'false'
  let manualCheck = false

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates…',
          click() {
            const r = dialog.showMessageBoxSync({
              type: 'question',
              buttons: ['Cancel', 'Check'],
              defaultId: 1,
              cancelId: 0,
              title: 'Check for Updates',
              message: 'Check for updates?',
              detail: `Current version: ${app.getVersion()}`,
            })
            if (r !== 1) return
            manualCheck = true
            autoUpdater.checkForUpdates()
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates Automatically',
          type: 'checkbox',
          checked: autoCheckEnabled,
          click(menuItem) {
            database.setSetting('autoCheckUpdates', menuItem.checked ? 'true' : 'false')
            if (menuItem.checked) {
              manualCheck = false
              autoUpdater.checkForUpdates()
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About HOTSVIZ',
          click() {
            dialog.showMessageBox({
              type: 'info',
              title: 'About HOTSVIZ',
              message: 'HOTSVIZ',
              detail: `Version ${app.getVersion()}\nLocal Heroes of the Storm replay analysis.\nYour data never leaves your machine.`,
            })
          },
        },
        {
          label: 'How to',
          click() {
            dialog.showMessageBox({
              type: 'info',
              title: 'How to use HOTSVIZ',
              message: 'How to use HOTSVIZ',
              detail: [
                'Getting started:',
                '1. Click "Select folder" and choose the folder where Heroes of the Storm saves replays (usually Documents\\Heroes of the Storm\\Replays).',
                '2. Click "Import" to analyze your replays.',
                '3. View your personal stats on the dashboard.',
                '',
                'Tips:',
                '• Use "Fast" mode to skip already-imported replays.',
                '• Use "Clean" mode to rebuild the database from scratch.',
                '• Filter by game mode, hero, map, or date to focus your analysis.',
                '• Use the Draft Helper to find your best heroes for a selected map. Pick a map in the Draft Helper and it will rank heroes based on your win rate, recent form, and confidence. Its analysis respects your current game mode and date filters.',
                '',
                'Need help?',
                'Report issues at:',
                'github.com/pi11e/HOTSVIZ_Desktop/issues',
              ].join('\n'),
            })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', () => {
    console.log('Update available — downloading…')
  })

  autoUpdater.on('update-not-available', () => {
    if (manualCheck) {
      dialog.showMessageBox({
        type: 'info',
        title: 'No Updates',
        message: 'No updates available.',
        detail: `You're on the latest version (${app.getVersion()}).`,
      })
      manualCheck = false
    }
  })

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Not now', 'Restart now'],
      defaultId: 1,
      cancelId: 0,
      title: 'Update Ready',
      message: 'An update is ready to install.',
      detail: `Version ${info.version} has been downloaded. Restart to apply the update.`,
    }).then(({ response }) => {
      if (response === 1) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', (err) => {
    if (manualCheck) {
      dialog.showMessageBox({
        type: 'error',
        title: 'Update Error',
        message: 'Unable to check for updates.',
        detail: err.message,
      })
      manualCheck = false
    } else {
      console.error('Background update check failed:', err.message)
    }
  })

  if (autoCheckEnabled) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000)
  }

  createWindow()
})

app.on('window-all-closed', () => {
  database?.close()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => { if (!window) createWindow() })
