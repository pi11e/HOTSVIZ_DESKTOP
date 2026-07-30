export interface ReplayFolder {
  folderPath: string
  replayCount: number
}

export interface ImportProgress {
  current: number
  total: number
  imported: number
  skipped: number
  failed: number
  currentFile?: string
  elapsedMs: number
  estimatedMs: number
}

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
  ownerUnknown: number
  errors: string[]
}

export interface ImportRun {
  id: number
  folderPath: string
  startedAt: string
  finishedAt: string | null
  totalFiles: number | null
  imported: number
  skipped: number
  failed: number
  status: 'running' | 'completed' | 'cancelled'
}

export interface DashboardFilters {
  since?: string
  map?: string
  hero?: string
  lastGames?: number
  gameMode?: string
}

export interface WinRateStat {
  label: string
  games: number
  wins: number
  winRate: number
  delta?: number
}

export interface DashboardData {
  totalGames: number
  totalWins: number
  winRate: number
  mostPlayedHero: string | null
  heroStats: WinRateStat[]
  mapStats: WinRateStat[]
  availableMaps: string[]
  availableHeroes: string[]
}

export interface DashboardInsight {
  text: string
  trend: 'up' | 'down' | 'flat'
}

export interface DashboardSummary extends DashboardData {
  lastImportAt: string | null
  previousWinRate: number | null
  winRateDelta: number | null
  bestHero: { name: string; winRate: number; games: number } | null
  insight: DashboardInsight | null
}

export interface MatchRecord {
  sourcePath: string
  playedAt: string
  gameMode: string
  mapName: string
  heroName: string
  won: boolean
  partySize: number
  importedAt: string
}

export interface HeatmapCell {
  hero: string
  map: string
  winRate: number | null
  gamesPlayed: number
}

export interface HeatmapData {
  cells: HeatmapCell[]
  heroes: string[]
  maps: string[]
}

export interface TrendPoint {
  date: string
  dailyWinRate: number
  aggregateWinRate: number
  gamesPlayed: number
}

export interface PartySizeStat {
  partySize: number
  wins: number
  losses: number
  winRate: number
}

export interface DraftHeroScore {
  heroName: string
  mapGames: number
  mapWins: number
  mapWinRate: number
  overallGames: number
  overallWins: number
  overallWinRate: number
  recentGames: number
  recentWins: number
  recentWinRate: number
  recentForm: boolean[]
  compositeScore: number
  confidence: 'low' | 'medium' | 'high'
}

