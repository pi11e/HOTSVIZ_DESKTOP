import { describe, it, expect, afterEach } from 'vitest'
import { createTestDb, makeMatch } from './helpers'
import type { DatabaseService } from '../src/main/database'

let db: DatabaseService

afterEach(() => {
  if (db) db.close()
})

async function seedMatches(db: DatabaseService, count: number, overrides: Partial<Parameters<typeof makeMatch>[0]> = {}): Promise<void> {
  for (let i = 0; i < count; i++) {
    const day = String(i + 1).padStart(2, '0')
    await db.insertMatch(makeMatch({
      id: `seed-${i}`,
      sourcePath: `/seed${i}.StormReplay`,
      playedAt: `2026-07-${day}T20:00:00Z`,
      won: i % 3 !== 0,
      partySize: (i % 5) + 1,
      mapName: i % 2 === 0 ? 'AlteracPass' : 'BraxisHoldout',
      heroName: i % 3 === 0 ? 'Genji' : i % 3 === 1 ? 'Jaina' : 'ETC',
      ...overrides,
    }))
  }
}

describe('getDashboard', () => {
  it('returns zeros and empty arrays for an empty DB', async () => {
    db = await createTestDb()
    const data = await db.getDashboard({})
    expect(data.totalGames).toBe(0)
    expect(data.totalWins).toBe(0)
    expect(data.winRate).toBe(0)
    expect(data.mostPlayedHero).toBeNull()
    expect(data.heroStats).toEqual([])
    expect(data.mapStats).toEqual([])
  })

  it('returns correct summary for seeded data', async () => {
    db = await createTestDb()
    await seedMatches(db, 3)
    const data = await db.getDashboard({})
    expect(data.totalGames).toBe(3)
    // wins: seed-0 (false), seed-1 (true), seed-2 (true) => 2 wins
    expect(data.totalWins).toBe(2)
    expect(data.winRate).toBeCloseTo(2 / 3, 4)
    // All 3 heroes have 1 game each; tie broken alphabetically → ETC
    expect(data.mostPlayedHero).toBe('ETC')
  })

  it('respects gameMode filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 2)
    await db.insertMatch(makeMatch({ id: 'qm1', sourcePath: '/qm1.StormReplay', gameMode: 'quickMatch', playedAt: '2026-07-01T12:00:00Z' }))
    const storm = await db.getDashboard({ gameMode: 'stormLeague' })
    expect(storm.totalGames).toBe(2)
    const quick = await db.getDashboard({ gameMode: 'quickMatch' })
    expect(quick.totalGames).toBe(1)
  })

  it('respects since filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 5)
    const data = await db.getDashboard({ since: '2026-07-04T00:00:00Z' })
    expect(data.totalGames).toBe(2) // days 4 and 5
  })

  it('respects hero filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 3)
    const data = await db.getDashboard({ hero: 'Jaina' })
    expect(data.totalGames).toBe(1)
    expect(data.heroStats[0]?.label).toBe('Jaina')
  })

  it('respects lastGames filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 5)
    const data = await db.getDashboard({ lastGames: 2 })
    expect(data.totalGames).toBe(2)
  })

  it('combines multiple filters', async () => {
    db = await createTestDb()
    await seedMatches(db, 6)
    await db.insertMatch(makeMatch({ id: 'extra', sourcePath: '/extra.StormReplay', gameMode: 'quickMatch', heroName: 'Genji', playedAt: '2026-07-06T12:00:00Z' }))
    const data = await db.getDashboard({ gameMode: 'stormLeague', hero: 'Genji' })
    expect(data.heroStats.length).toBeGreaterThanOrEqual(1)
    expect(data.heroStats.every(s => s.label === 'Genji')).toBe(true)
  })

  it('scopes availableHeroes and availableMaps to selected gameMode', async () => {
    db = await createTestDb()
    await seedMatches(db, 2)
    await db.insertMatch(makeMatch({ id: 'qm', sourcePath: '/qm.StormReplay', gameMode: 'quickMatch', mapName: 'TombOfTheSpiderQueen', heroName: 'LiMing', playedAt: '2026-07-01T12:00:00Z' }))
    const storm = await db.getDashboard({ gameMode: 'stormLeague'})
    expect(storm.availableHeroes).not.toContain('LiMing')
    expect(storm.availableMaps).not.toContain('TombOfTheSpiderQueen')
    const quick = await db.getDashboard({ gameMode: 'quickMatch' })
    expect(quick.availableHeroes).toContain('LiMing')
    expect(quick.availableMaps).toContain('TombOfTheSpiderQueen')
  })

  it('returns lastImportAt from the most recent finished import run', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch())
    const runId = await db.createImportRun('/test')
    const now = new Date().toISOString()
    await db.updateImportRun(runId, { finishedAt: now, status: 'completed' })
    const data = await db.getDashboard({})
    expect(data.lastImportAt).toBe(now)
  })

  it('returns null lastImportAt when no import runs exist', async () => {
    db = await createTestDb()
    const data = await db.getDashboard({})
    expect(data.lastImportAt).toBeNull()
  })

  it('computes bestHero with >= 5 games', async () => {
    db = await createTestDb()
    // Genji: 6 wins in 6 games → best hero
    for (let i = 0; i < 6; i++) {
      await db.insertMatch(makeMatch({ heroName: 'Genji', won: true, sourcePath: `/bh${i}.StormReplay`, playedAt: `2026-07-0${i + 1}T12:00:00Z` }))
    }
    // Jaina: 2 wins in 4 games → not enough games
    await db.insertMatch(makeMatch({ heroName: 'Jaina', won: true, sourcePath: '/bh6.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Jaina', won: true, sourcePath: '/bh7.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Jaina', won: false, sourcePath: '/bh8.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Jaina', won: false, sourcePath: '/bh9.StormReplay' }))
    const data = await db.getDashboard({})
    expect(data.bestHero).toBeDefined()
    expect(data.bestHero!.name).toBe('Genji')
    expect(data.bestHero!.winRate).toBeCloseTo(1.0, 4)
    expect(data.bestHero!.games).toBe(6)
  })

  it('returns null bestHero when no hero has >= 5 games', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', sourcePath: '/bh1.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Genji', sourcePath: '/bh2.StormReplay' }))
    const data = await db.getDashboard({})
    expect(data.bestHero).toBeNull()
  })

  it('computes winRateDelta by splitting filtered matches in half', async () => {
    db = await createTestDb()
    // 4 games: 2 old (both losses), 2 recent (both wins)
    // older half: 0% WR, recent half: 100% WR, delta = +0.50
    await db.insertMatch(makeMatch({ won: false, playedAt: '2026-07-01T12:00:00Z', sourcePath: '/d1.StormReplay' }))
    await db.insertMatch(makeMatch({ won: false, playedAt: '2026-07-02T12:00:00Z', sourcePath: '/d2.StormReplay' }))
    await db.insertMatch(makeMatch({ won: true, playedAt: '2026-07-03T12:00:00Z', sourcePath: '/d3.StormReplay' }))
    await db.insertMatch(makeMatch({ won: true, playedAt: '2026-07-04T12:00:00Z', sourcePath: '/d4.StormReplay' }))
    const data = await db.getDashboard({})
    expect(data.winRateDelta).not.toBeNull()
    expect(data.winRateDelta!).toBeCloseTo(0.5, 4)
    expect(data.previousWinRate).toBeCloseTo(0, 4)
    expect(data.winRate).toBeCloseTo(0.5, 4)
  })

  it('returns null delta with insufficient data for splitting', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ sourcePath: '/d1.StormReplay' }))
    const data = await db.getDashboard({})
    expect(data.winRateDelta).toBeNull()
    expect(data.previousWinRate).toBeNull()
  })

  it('generates insight with correct trend direction', async () => {
    db = await createTestDb()
    // Strong upward trend: old = losses, new = wins
    for (let i = 0; i < 4; i++) {
      await db.insertMatch(makeMatch({ won: false, playedAt: `2026-07-0${i + 1}T12:00:00Z`, sourcePath: `/ins${i}.StormReplay` }))
    }
    for (let i = 4; i < 8; i++) {
      await db.insertMatch(makeMatch({ won: true, playedAt: `2026-07-${String(i + 1).padStart(2, '0')}T12:00:00Z`, sourcePath: `/ins${i}.StormReplay` }))
    }
    const data = await db.getDashboard({})
    expect(data.insight).not.toBeNull()
    expect(data.insight!.trend).toBe('up')
    expect(data.insight!.text).toContain('up')
  })

  it('generates flat insight for stable performance', async () => {
    db = await createTestDb()
    // All wins → delta is 0 → flat
    for (let i = 0; i < 4; i++) {
      await db.insertMatch(makeMatch({ won: true, playedAt: `2026-07-0${i + 1}T12:00:00Z`, sourcePath: `/flat${i}.StormReplay` }))
    }
    const data = await db.getDashboard({})
    expect(data.insight).not.toBeNull()
    expect(data.insight!.trend).toBe('flat')
  })
})

describe('getMatches', () => {
  it('returns correct MatchRecord shape', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ sourcePath: '/x.StormReplay', playedAt: '2026-07-22T12:00:00Z' }))
    const { matches, total } = await db.getMatches({})
    expect(total).toBe(1)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      sourcePath: '/x.StormReplay',
      gameMode: 'stormLeague',
      mapName: 'AlteracPass',
      heroName: 'Genji',
      won: true,
      partySize: 1,
    })
    expect(matches[0].importedAt).toBeTypeOf('string')
  })

  it('lastGames limits rows but total reflects full count', async () => {
    db = await createTestDb()
    await seedMatches(db, 5)
    const { matches, total } = await db.getMatches({ lastGames: 2 })
    expect(total).toBe(5)
    expect(matches).toHaveLength(2)
  })

  it('respects since filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 5)
    const { matches } = await db.getMatches({ since: '2026-07-04T00:00:00Z' })
    expect(matches.length).toBe(2)
  })

  it('respects map filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 4)
    const { matches } = await db.getMatches({ map: 'AlteracPass' })
    expect(matches.every(m => m.mapName === 'AlteracPass')).toBe(true)
  })

  it('respects hero filter', async () => {
    db = await createTestDb()
    await seedMatches(db, 6)
    const { matches } = await db.getMatches({ hero: 'ETC' })
    expect(matches.every(m => m.heroName === 'ETC')).toBe(true)
  })
})

describe('getHeatmapData', () => {
  it('returns cells for every hero×map combo via cross-join', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass' }))
    const data = await db.getHeatmapData({})
    expect(data.heroes).toContain('Genji')
    expect(data.maps).toContain('AlteracPass')
    expect(data.cells.length).toBe(data.heroes.length * data.maps.length)
  })

  it('played combos have correct winRate and gamesPlayed', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', won: true }))
    await db.insertMatch(makeMatch({ id: 'm2', sourcePath: '/m2.StormReplay', heroName: 'Genji', mapName: 'AlteracPass', won: false }))
    const data = await db.getHeatmapData({})
    const cell = data.cells.find(c => c.hero === 'Genji' && c.map === 'AlteracPass')
    expect(cell).toBeDefined()
    expect(cell!.winRate).toBeCloseTo(0.5, 4)
    expect(cell!.gamesPlayed).toBe(2)
  })

  it('unplayed combos have null winRate and 0 gamesPlayed', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass' }))
    // Now insert a second hero to get cross-join
    await db.insertMatch(makeMatch({ id: 'm2', sourcePath: '/m2.StormReplay', heroName: 'Jaina', mapName: 'AlteracPass' }))
    const data = await db.getHeatmapData({})
    // All cells should exist for the cross-join
    expect(data.cells.length).toBe(data.heroes.length * data.maps.length)
    // Both heroes have data on AlteracPass
    const genjiCell = data.cells.find(c => c.hero === 'Genji' && c.map === 'AlteracPass')
    const jainaCell = data.cells.find(c => c.hero === 'Jaina' && c.map === 'AlteracPass')
    expect(genjiCell!.winRate).not.toBeNull()
    expect(jainaCell!.winRate).not.toBeNull()
  })

  it('gameMode filter scopes heroes/maps', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', gameMode: 'stormLeague' }))
    await db.insertMatch(makeMatch({ id: 'm2', sourcePath: '/m2.StormReplay', heroName: 'LiMing', mapName: 'TombOfTheSpiderQueen', gameMode: 'quickMatch' }))
    const storm = await db.getHeatmapData({ gameMode: 'stormLeague' })
    expect(storm.heroes).toContain('Genji')
    expect(storm.heroes).not.toContain('LiMing')
  })
})

describe('getTrendData', () => {
  it('single-day data returns one TrendPoint', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ playedAt: '2026-07-22T12:00:00Z', won: true }))
    const trend = await db.getTrendData({})
    expect(trend).toHaveLength(1)
    expect(trend[0].dailyWinRate).toBe(1)
    expect(trend[0].gamesPlayed).toBe(1)
  })

  it('multi-day data has correct daily and cumulative win rates', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ playedAt: '2026-07-01T12:00:00Z', won: true, sourcePath: '/1.StormReplay' }))
    await db.insertMatch(makeMatch({ playedAt: '2026-07-02T12:00:00Z', won: false, sourcePath: '/2.StormReplay' }))
    await db.insertMatch(makeMatch({ playedAt: '2026-07-03T12:00:00Z', won: true, sourcePath: '/3.StormReplay' }))
    const trend = await db.getTrendData({})
    expect(trend).toHaveLength(3)
    // Day 1: 1 win / 1 game = 1.0, cumulative = 1.0
    expect(trend[0].dailyWinRate).toBeCloseTo(1.0, 4)
    expect(trend[0].aggregateWinRate).toBeCloseTo(1.0, 4)
    // Day 2: 0 wins / 1 game = 0.0, cumulative = 1/2 = 0.5
    expect(trend[1].dailyWinRate).toBeCloseTo(0.0, 4)
    expect(trend[1].aggregateWinRate).toBeCloseTo(0.5, 4)
    // Day 3: 1 win / 1 game = 1.0, cumulative = 2/3 ≈ 0.6667
    expect(trend[2].dailyWinRate).toBeCloseTo(1.0, 4)
    expect(trend[2].aggregateWinRate).toBeCloseTo(2 / 3, 4)
  })

  it('lastGames affects which games feed the aggregate', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ playedAt: '2026-07-01T12:00:00Z', won: true, sourcePath: '/1.StormReplay' }))
    await db.insertMatch(makeMatch({ playedAt: '2026-07-02T12:00:00Z', won: false, sourcePath: '/2.StormReplay' }))
    await db.insertMatch(makeMatch({ playedAt: '2026-07-03T12:00:00Z', won: true, sourcePath: '/3.StormReplay' }))
    const trend = await db.getTrendData({ lastGames: 2 })
    expect(trend).toHaveLength(2)
    // Last 2 games: day2 (loss) + day3 (win), aggregate = 0.5
    expect(trend[1].aggregateWinRate).toBeCloseTo(0.5, 4)
  })
})

describe('getPartyData', () => {
  it('returns correct wins/losses per party size', async () => {
    db = await createTestDb()
    // Solo (partySize=1): 2 wins, 1 loss
    await db.insertMatch(makeMatch({ partySize: 1, won: true, sourcePath: '/s1.StormReplay' }))
    await db.insertMatch(makeMatch({ partySize: 1, won: true, sourcePath: '/s2.StormReplay' }))
    await db.insertMatch(makeMatch({ partySize: 1, won: false, sourcePath: '/s3.StormReplay' }))
    // Duo (partySize=2): 1 win, 1 loss
    await db.insertMatch(makeMatch({ partySize: 2, won: true, sourcePath: '/d1.StormReplay' }))
    await db.insertMatch(makeMatch({ partySize: 2, won: false, sourcePath: '/d2.StormReplay' }))
    const data = await db.getPartyData({})
    const solo = data.find(d => d.partySize === 1)
    const duo = data.find(d => d.partySize === 2)
    expect(solo).toEqual({ partySize: 1, wins: 2, losses: 1, winRate: 2 / 3 })
    expect(duo).toEqual({ partySize: 2, wins: 1, losses: 1, winRate: 0.5 })
  })

  it('respects since filter', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ partySize: 1, won: true, sourcePath: '/old.StormReplay', playedAt: '2026-01-01T12:00:00Z' }))
    await db.insertMatch(makeMatch({ partySize: 1, won: false, sourcePath: '/new.StormReplay', playedAt: '2026-07-22T12:00:00Z' }))
    const data = await db.getPartyData({ since: '2026-07-01T00:00:00Z' })
    expect(data.find(d => d.partySize === 1)).toEqual({ partySize: 1, wins: 0, losses: 1, winRate: 0 })
  })
})

describe('getDraftData', () => {
  it('returns empty array when no map provided', async () => {
    db = await createTestDb()
    await seedMatches(db, 3)
    const data = await db.getDraftData({})
    expect(data).toEqual([])
  })

  it('returns scores sorted by compositeScore descending', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', won: true, sourcePath: '/g1.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Jaina', mapName: 'AlteracPass', won: false, sourcePath: '/j1.StormReplay' }))
    const data = await db.getDraftData({ map: 'AlteracPass' })
    expect(data.length).toBeGreaterThanOrEqual(2)
    expect(data[0].compositeScore).toBeGreaterThanOrEqual(data[1].compositeScore)
  })

  it('composite formula matches manual calculation', async () => {
    db = await createTestDb()
    // Genji: 2 wins on AlteracPass, 3 overall, 1 recent
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', won: true, playedAt: '2026-07-01T12:00:00Z', sourcePath: '/g1.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', won: true, playedAt: '2026-07-02T12:00:00Z', sourcePath: '/g2.StormReplay' }))
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'BraxisHoldout', won: false, playedAt: '2026-07-03T12:00:00Z', sourcePath: '/g3.StormReplay' }))
    const data = await db.getDraftData({ map: 'AlteracPass' })
    const genji = data.find(d => d.heroName === 'Genji')
    expect(genji).toBeDefined()
    // mapWinRate = 2/2 = 1.0
    expect(genji!.mapWinRate).toBeCloseTo(1.0, 4)
    // overallWinRate = 2/3 ≈ 0.6667
    expect(genji!.overallWinRate).toBeCloseTo(2 / 3, 4)
    // recentWinRate: all 3 Genji games are within last 5, 2 won → 2/3
    expect(genji!.recentWinRate).toBeCloseTo(2 / 3, 4)
    // confidence bonus: mapGames=2, bonus=0.2
    // compositeScore = 1.0*0.5 + (2/3)*0.25 + (2/3)*0.15 + 0.2*0.10
    expect(genji!.compositeScore).toBeCloseTo(1.0 * 0.5 + (2 / 3) * 0.25 + (2 / 3) * 0.15 + 0.2 * 0.10, 4)
  })

  it('confidence levels', async () => {
    db = await createTestDb()
    // High confidence: >= 11 games on map
    for (let i = 0; i < 11; i++) {
      await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', won: true, sourcePath: `/hc${i}.StormReplay` }))
    }
    const data = await db.getDraftData({ map: 'AlteracPass' })
    expect(data[0].confidence).toBe('high')
  })

  it('recentForm has up to 5 booleans', async () => {
    db = await createTestDb()
    for (let i = 0; i < 7; i++) {
      await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'AlteracPass', won: i % 2 === 0, sourcePath: `/rf${i}.StormReplay`, playedAt: `2026-07-0${i + 1}T12:00:00Z` }))
    }
    const data = await db.getDraftData({ map: 'AlteracPass' })
    expect(data[0].recentForm.length).toBeLessThanOrEqual(5)
    expect(data[0].recentForm.length).toBeGreaterThan(0)
  })

  it('heroes with no map-specific data still appear', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ heroName: 'Genji', mapName: 'BraxisHoldout', won: true, sourcePath: '/ng.StormReplay' }))
    const data = await db.getDraftData({ map: 'AlteracPass' })
    const genji = data.find(d => d.heroName === 'Genji')
    expect(genji).toBeDefined()
    expect(genji!.mapGames).toBe(0)
    expect(genji!.mapWinRate).toBe(0)
  })
})

describe('getGameModes', () => {
  it('returns distinct modes sorted alphabetically', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ gameMode: 'quickMatch', sourcePath: '/qm.StormReplay' }))
    await db.insertMatch(makeMatch({ gameMode: 'stormLeague', sourcePath: '/sl.StormReplay' }))
    await db.insertMatch(makeMatch({ gameMode: 'ar brawl', sourcePath: '/ab.StormReplay' }))
    const modes = await db.getGameModes()
    expect(modes).toEqual(['ar brawl', 'quickMatch', 'stormLeague'])
  })

  it('empty DB returns empty array', async () => {
    db = await createTestDb()
    expect(await db.getGameModes()).toEqual([])
  })
})
