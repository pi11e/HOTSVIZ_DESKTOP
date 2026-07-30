import type { DashboardFilters, DashboardSummary, DraftHeroScore, HeatmapData, ImportProgress, ImportResult, MatchRecord, PartySizeStat, ReplayFolder, TrendPoint } from '../shared/types'

declare const __APP_VERSION__: string

declare global {
  interface Window {
    hotsviz: {
      selectReplayFolder(): Promise<ReplayFolder | null>
      getReplayFolder(): Promise<ReplayFolder | null>
      importReplays(folderPath: string, clean: boolean): Promise<ImportResult>
      cancelImport(): Promise<void>
      getDashboard(filters: DashboardFilters): Promise<DashboardSummary>
      getMatchList(filters: DashboardFilters): Promise<{ matches: MatchRecord[]; total: number }>
      getHeatmapData(filters: DashboardFilters): Promise<HeatmapData>
      getTrendData(filters: DashboardFilters): Promise<TrendPoint[]>
      getPartyData(filters: DashboardFilters): Promise<PartySizeStat[]>
      getDraftData(filters: DashboardFilters): Promise<DraftHeroScore[]>
      getGameModes(): Promise<string[]>
      onImportProgress(callback: (progress: ImportProgress) => void): () => void
    }
  }
}

export {}

