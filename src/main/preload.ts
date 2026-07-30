import { contextBridge, ipcRenderer } from 'electron'
import type { DashboardFilters, DraftHeroScore, HeatmapData, ImportProgress, PartySizeStat, TrendPoint } from '../shared/types'

contextBridge.exposeInMainWorld('hotsviz', {
  selectReplayFolder: () => ipcRenderer.invoke('replays:select-folder'),
  getReplayFolder: () => ipcRenderer.invoke('replays:get-folder'),
  importReplays: (folderPath: string, clean: boolean) => ipcRenderer.invoke('replays:import', folderPath, clean),
  cancelImport: () => ipcRenderer.invoke('replays:import-cancel'),
  getDashboard: (filters: DashboardFilters) => ipcRenderer.invoke('dashboard:get', filters),
  getMatchList: (filters: DashboardFilters) => ipcRenderer.invoke('replays:list', filters),
  getHeatmapData: (filters: DashboardFilters) => ipcRenderer.invoke('heatmap:get', filters),
  getTrendData: (filters: DashboardFilters) => ipcRenderer.invoke('trend:get', filters),
  getPartyData: (filters: DashboardFilters) => ipcRenderer.invoke('party:get', filters),
  getDraftData: (filters: DashboardFilters) => ipcRenderer.invoke('draft:get', filters),
  getGameModes: () => ipcRenderer.invoke('gameModes:list'),
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ImportProgress) => callback(progress)
    ipcRenderer.on('replays:import-progress', listener)
    return () => ipcRenderer.removeListener('replays:import-progress', listener)
  },
})

