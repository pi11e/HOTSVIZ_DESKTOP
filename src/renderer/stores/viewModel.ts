import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DashboardFilters, DashboardSummary, DraftHeroScore, HeatmapData, ImportProgress, MatchRecord, PartySizeStat, ReplayFolder, TrendPoint } from '../../shared/types'

const emptyDashboard = (): DashboardSummary => ({ totalGames: 0, totalWins: 0, winRate: 0, mostPlayedHero: null, heroStats: [], mapStats: [], availableMaps: [], availableHeroes: [], lastImportAt: null, previousWinRate: null, winRateDelta: null, bestHero: null, insight: null })
const emptyHeatmap = (): HeatmapData => ({ cells: [], heroes: [], maps: [] })

export const useViewModel = defineStore('app', () => {
  const folder = ref<ReplayFolder | null>(null)
  const dashboard = ref<DashboardSummary>(emptyDashboard())
  const filters = ref<DashboardFilters>({ gameMode: 'stormLeague' })
  const progress = ref<ImportProgress | null>(null)
  const isImporting = ref(false)
  const importMode = ref<'fast' | 'clean'>('fast')
  const message = ref('Choose your replay folder to begin.')
  const error = ref<string | null>(null)
  const hasData = computed(() => dashboard.value.totalGames > 0)
  const hasEverImported = ref(false)
  const matchList = ref<MatchRecord[]>([])
  const totalMatches = ref(0)
  const heatmapData = ref<HeatmapData>(emptyHeatmap())
  const trendData = ref<TrendPoint[]>([])
  const partyData = ref<PartySizeStat[]>([])
  const draftData = ref<DraftHeroScore[]>([])
  const gameModes = ref<string[]>([])
  async function refreshDashboard(): Promise<void> {
    // Vue wraps object refs in proxies. IPC requires a structured-cloneable plain object.
    const filterCopy = { ...filters.value }
    const [dash, matchResult, heatmap, trend, party, modes] = await Promise.all([
      window.hotsviz.getDashboard(filterCopy),
      window.hotsviz.getMatchList(filterCopy),
      window.hotsviz.getHeatmapData(filterCopy),
      window.hotsviz.getTrendData(filterCopy),
      window.hotsviz.getPartyData(filterCopy),
      window.hotsviz.getGameModes(),
    ])
    dashboard.value = dash
    matchList.value = matchResult.matches
    totalMatches.value = matchResult.total
    heatmapData.value = heatmap
    trendData.value = trend
    partyData.value = party
    gameModes.value = modes
  }

  async function load(): Promise<void> {
    folder.value = await window.hotsviz.getReplayFolder()
    hasEverImported.value = folder.value !== null
    await refreshDashboard()
  }

  async function selectFolder(): Promise<void> {
    error.value = null
    const result = await window.hotsviz.selectReplayFolder()
    if (!result) return
    folder.value = result
    message.value = `${result.replayCount} replay file${result.replayCount === 1 ? '' : 's'} found. Ready to import.`
  }

  async function importReplays(): Promise<void> {
    if (!folder.value || isImporting.value) return
    isImporting.value = true
    error.value = null
    progress.value = { current: 0, total: folder.value.replayCount, imported: 0, skipped: 0, failed: 0, elapsedMs: 0, estimatedMs: 0 }
    const unsubscribe = window.hotsviz.onImportProgress((value) => { progress.value = value })
    try {
      const result = await window.hotsviz.importReplays(folder.value.folderPath, importMode.value === 'clean')
      const modeLabel = importMode.value === 'clean' ? 'Clean import' : 'Import'
      const parts = [`${result.imported} imported`, `${result.skipped} already present`]
      if (result.failed) parts.push(`${result.failed} failed`)
      message.value = `${modeLabel} complete: ${parts.join(', ')}.`
      if (result.ownerUnknown) error.value = `${result.ownerUnknown} replays had an uncertain owner and used a fallback guess. Verify your stats look correct.`
      else if (result.failed) error.value = result.errors.slice(0, 3).join(' ')
      hasEverImported.value = true
      await refreshDashboard()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'The import failed unexpectedly.'
    } finally {
      unsubscribe()
      isImporting.value = false
    }
  }

  async function applyFilters(next: DashboardFilters): Promise<void> {
    filters.value = next
    await refreshDashboard()
  }

  async function clearFilters(): Promise<void> {
    filters.value = { gameMode: 'stormLeague' }
    await refreshDashboard()
  }

  async function fetchDraftData(mapName: string): Promise<void> {
    if (!mapName) { draftData.value = []; return }
    const filterCopy = { ...filters.value, map: mapName }
    draftData.value = await window.hotsviz.getDraftData(filterCopy)
  }

  async function cancelActiveImport(): Promise<void> {
    await window.hotsviz.cancelImport()
  }

  return { folder, dashboard, filters, progress, isImporting, importMode, message, error, hasData, hasEverImported, matchList, totalMatches, heatmapData, trendData, partyData, draftData, gameModes, load, selectFolder, importReplays, cancelActiveImport, applyFilters, clearFilters, fetchDraftData }
})
