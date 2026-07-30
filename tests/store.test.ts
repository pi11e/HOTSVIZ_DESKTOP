import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useViewModel } from '../src/renderer/stores/viewModel'

const mockHotsviz = {
  selectReplayFolder: vi.fn(),
  getReplayFolder: vi.fn(),
  importReplays: vi.fn(),
  cancelImport: vi.fn(),
  getDashboard: vi.fn(),
  getMatchList: vi.fn(),
  getHeatmapData: vi.fn(),
  getTrendData: vi.fn(),
  getPartyData: vi.fn(),
  getDraftData: vi.fn(),
  getGameModes: vi.fn(),
  onImportProgress: vi.fn(),
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('window', { hotsviz: mockHotsviz })
  vi.clearAllMocks()
  mockHotsviz.getReplayFolder.mockResolvedValue(null)
  mockHotsviz.getDashboard.mockResolvedValue({ totalGames: 0, totalWins: 0, winRate: 0, mostPlayedHero: null, heroStats: [], mapStats: [], availableMaps: [], availableHeroes: [] })
  mockHotsviz.getMatchList.mockResolvedValue({ matches: [], total: 0 })
  mockHotsviz.getHeatmapData.mockResolvedValue({ cells: [], heroes: [], maps: [] })
  mockHotsviz.getTrendData.mockResolvedValue([])
  mockHotsviz.getPartyData.mockResolvedValue([])
  mockHotsviz.getGameModes.mockResolvedValue([])
})

describe('useViewModel — initial state', () => {
  it('has correct defaults', () => {
    const vm = useViewModel()
    expect(vm.filters).toEqual({ gameMode: 'stormLeague' })
    expect(vm.hasData).toBe(false)
    expect(vm.isImporting).toBe(false)
    expect(vm.folder).toBeNull()
    expect(vm.message).toBe('Choose your replay folder to begin.')
    expect(vm.error).toBeNull()
    expect(vm.importMode).toBe('fast')
  })
})

describe('useViewModel — load', () => {
  it('calls getReplayFolder, getGameModes, refreshDashboard', async () => {
    const vm = useViewModel()
    await vm.load()
    expect(mockHotsviz.getReplayFolder).toHaveBeenCalledOnce()
    expect(mockHotsviz.getGameModes).toHaveBeenCalledOnce()
    expect(mockHotsviz.getDashboard).toHaveBeenCalled()
    expect(mockHotsviz.getMatchList).toHaveBeenCalled()
    expect(mockHotsviz.getHeatmapData).toHaveBeenCalled()
    expect(mockHotsviz.getTrendData).toHaveBeenCalled()
    expect(mockHotsviz.getPartyData).toHaveBeenCalled()
  })

  it('sets hasEverImported when folder exists', async () => {
    mockHotsviz.getReplayFolder.mockResolvedValue({ folderPath: '/replays', replayCount: 5 })
    const vm = useViewModel()
    await vm.load()
    expect(vm.hasEverImported).toBe(true)
    expect(vm.folder).toEqual({ folderPath: '/replays', replayCount: 5 })
  })
})

describe('useViewModel — applyFilters', () => {
  it('updates filters and refreshes dashboard', async () => {
    const vm = useViewModel()
    await vm.load()
    vi.clearAllMocks()
    mockHotsviz.getDashboard.mockResolvedValue({ totalGames: 10, totalWins: 5, winRate: 0.5, mostPlayedHero: 'Genji', heroStats: [], mapStats: [], availableMaps: [], availableHeroes: [] })
    await vm.applyFilters({ hero: 'Genji', gameMode: 'stormLeague' })
    expect(vm.filters.hero).toBe('Genji')
    expect(mockHotsviz.getDashboard).toHaveBeenCalled()
  })
})

describe('useViewModel — clearFilters', () => {
  it('resets to stormLeague default', async () => {
    const vm = useViewModel()
    await vm.load()
    await vm.applyFilters({ hero: 'Genji' })
    await vm.clearFilters()
    expect(vm.filters).toEqual({ gameMode: 'stormLeague' })
  })
})

describe('useViewModel — importReplays', () => {
  it('sets isImporting, calls import, refreshes dashboard, clears isImporting', async () => {
    mockHotsviz.getReplayFolder.mockResolvedValue({ folderPath: '/replays', replayCount: 3 })
    mockHotsviz.importReplays.mockResolvedValue({ imported: 3, skipped: 0, failed: 0, ownerUnknown: 0, errors: [] })
    mockHotsviz.onImportProgress.mockReturnValue(() => {})
    const vm = useViewModel()
    await vm.load()
    await vm.importReplays()
    expect(vm.isImporting).toBe(false)
    expect(vm.message).toContain('3 imported')
    expect(vm.hasEverImported).toBe(true)
  })

  it('sets error message on failure', async () => {
    mockHotsviz.getReplayFolder.mockResolvedValue({ folderPath: '/replays', replayCount: 1 })
    mockHotsviz.importReplays.mockRejectedValue(new Error('Parser not found'))
    mockHotsviz.onImportProgress.mockReturnValue(() => {})
    const vm = useViewModel()
    await vm.load()
    await vm.importReplays()
    expect(vm.error).toBe('Parser not found')
    expect(vm.isImporting).toBe(false)
  })

  it('shows owner warning when ownerUnknown > 0', async () => {
    mockHotsviz.getReplayFolder.mockResolvedValue({ folderPath: '/replays', replayCount: 2 })
    mockHotsviz.importReplays.mockResolvedValue({ imported: 2, skipped: 0, failed: 0, ownerUnknown: 2, errors: [] })
    mockHotsviz.onImportProgress.mockReturnValue(() => {})
    const vm = useViewModel()
    await vm.load()
    await vm.importReplays()
    expect(vm.error).toContain('uncertain owner')
  })
})

describe('useViewModel — cancelActiveImport', () => {
  it('delegates to window.hotsviz.cancelImport', async () => {
    const vm = useViewModel()
    await vm.cancelActiveImport()
    expect(mockHotsviz.cancelImport).toHaveBeenCalledOnce()
  })
})
