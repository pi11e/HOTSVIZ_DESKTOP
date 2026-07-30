import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import sqlite3 from 'sqlite3'
import type { DashboardData, DashboardFilters, DashboardInsight, DashboardSummary, DraftHeroScore, HeatmapCell, HeatmapData, ImportRun, MatchRecord, PartySizeStat, TrendPoint, WinRateStat } from '../shared/types'

type SqlParams = Array<string | number>

export interface MatchInput {
  id: string
  sourcePath: string
  playedAt: string
  gameMode: string
  mapName: string
  heroName: string
  won: boolean
  partySize: number
}

export class DatabaseService {
  private readonly db: sqlite3.Database

  constructor(dbPath?: string) {
    if (dbPath) {
      this.db = new sqlite3.Database(dbPath)
    } else {
      const directory = path.join(app.getPath('userData'), 'data')
      fs.mkdirSync(directory, { recursive: true })
      this.db = new sqlite3.Database(path.join(directory, 'hotsviz.db'))
    }
  }

  async initialize(): Promise<void> {
    await this.run('PRAGMA journal_mode = WAL')
    await this.run('PRAGMA foreign_keys = ON')
    await this.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
    await this.run(`CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL UNIQUE,
      played_at TEXT NOT NULL,
      game_mode TEXT NOT NULL,
      map_name TEXT NOT NULL,
      hero_name TEXT NOT NULL,
      won INTEGER NOT NULL CHECK (won IN (0, 1)),
      party_size INTEGER NOT NULL DEFAULT 1,
      imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await this.run('CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC)')
    await this.run('CREATE INDEX IF NOT EXISTS idx_matches_map ON matches(map_name)')
    await this.run(`CREATE TABLE IF NOT EXISTS import_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      total_files INTEGER,
      imported INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running'
    )`)
  }

  run(sql: string, params: SqlParams = []): Promise<void> {
    return new Promise((resolve, reject) => this.db.run(sql, params, (error) => error ? reject(error) : resolve()))
  }

  get<T>(sql: string, params: SqlParams = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => this.db.get(sql, params, (error, row) => error ? reject(error) : resolve(row as T)))
  }

  all<T>(sql: string, params: SqlParams = []): Promise<T[]> {
    return new Promise((resolve, reject) => this.db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows as T[])))
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await this.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])
    return row?.value ?? null
  }

  async insertMatch(match: MatchInput): Promise<boolean> {
    try {
      await this.run(`INSERT INTO matches(id, source_path, played_at, game_mode, map_name, hero_name, won, party_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        match.id, match.sourcePath, match.playedAt, match.gameMode, match.mapName,
        match.heroName, match.won ? 1 : 0, match.partySize,
      ])
      return true
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return false
      throw error
    }
  }

  async hasMatch(sourcePath: string): Promise<boolean> {
    const row = await this.get<{ source_path: string }>('SELECT 1 FROM matches WHERE source_path = ? LIMIT 1', [sourcePath])
    return row !== undefined
  }

  async getGameModes(): Promise<string[]> {
    const rows = await this.all<{ game_mode: string }>('SELECT DISTINCT game_mode FROM matches ORDER BY game_mode')
    return rows.map((r) => r.game_mode)
  }

  async getDashboard(filters: DashboardFilters): Promise<DashboardSummary> {
    const where: string[] = []
    const params: SqlParams = []
    if (filters.gameMode) { where.push('game_mode = ?'); params.push(filters.gameMode) }
    if (filters.since) { where.push('played_at >= ?'); params.push(filters.since) }
    if (filters.map) { where.push('map_name = ?'); params.push(filters.map) }
    if (filters.hero) { where.push('hero_name = ?'); params.push(filters.hero) }
    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
    const limit = filters.lastGames && filters.lastGames > 0 ? ' LIMIT ?' : ''
    if (limit) params.push(filters.lastGames!)
    const base = `WITH filtered AS (SELECT * FROM matches${whereClause} ORDER BY played_at DESC${limit})`
    const summary = await this.get<{ games: number; wins: number; hero: string | null }>(`${base}
      SELECT COUNT(*) AS games, COALESCE(SUM(won), 0) AS wins,
      (SELECT hero_name FROM filtered GROUP BY hero_name ORDER BY COUNT(*) DESC, hero_name LIMIT 1) AS hero FROM filtered`, params)
    const stats = await this.all<{ label: string; games: number; wins: number }>(`${base}
      SELECT hero_name AS label, COUNT(*) AS games, SUM(won) AS wins FROM filtered GROUP BY hero_name ORDER BY games DESC, label LIMIT 10`, params)
    const recent = await this.all<{ hero_name: string; recent_wins: number; recent_games: number }>(`${base},
      hero_recent AS (
        SELECT hero_name, won, ROW_NUMBER() OVER (PARTITION BY hero_name ORDER BY played_at DESC) AS rn
        FROM filtered
      )
      SELECT hero_name, SUM(won) AS recent_wins, COUNT(*) AS recent_games
      FROM hero_recent WHERE rn <= 10
      GROUP BY hero_name`, params)
    const recentMap = new Map(recent.map((r) => [r.hero_name, r]))
    const maps = await this.all<{ label: string; games: number; wins: number }>(`${base}
      SELECT map_name AS label, COUNT(*) AS games, SUM(won) AS wins FROM filtered GROUP BY map_name ORDER BY games DESC, label`, params)
    const modeClause = filters.gameMode ? ' WHERE game_mode = ?' : ''
    const modeParams = filters.gameMode ? [filters.gameMode] : []
    const availableMaps = await this.all<{ map_name: string }>(`SELECT DISTINCT map_name FROM matches${modeClause} ORDER BY map_name`, modeParams)
    const availableHeroes = await this.all<{ hero_name: string }>(`SELECT DISTINCT hero_name FROM matches${modeClause} ORDER BY hero_name`, modeParams)
    const toStat = (row: { label: string; games: number; wins: number }): WinRateStat => {
      const winRate = row.games ? row.wins / row.games : 0
      const r = recentMap.get(row.label)
      let delta: number | undefined
      if (r && row.games >= 3 && r.recent_games > 0) {
        delta = (r.recent_wins / r.recent_games) - winRate
      }
      return { ...row, winRate, delta }
    }
    const games = summary?.games ?? 0
    const wins = summary?.wins ?? 0
    const winRate = games ? wins / games : 0

    const bestHeroRow = await this.get<{ hero_name: string; games: number; wins: number }>(`${base}
      SELECT hero_name, COUNT(*) AS games, SUM(won) AS wins FROM filtered
      GROUP BY hero_name HAVING COUNT(*) >= 5 ORDER BY CAST(SUM(won) AS REAL) / COUNT(*) DESC, COUNT(*) DESC LIMIT 1`, params)
    const bestHero = bestHeroRow ? { name: bestHeroRow.hero_name, winRate: bestHeroRow.wins / bestHeroRow.games, games: bestHeroRow.games } : null

    const halfRow = await this.get<{ half: number }>(`${base} SELECT COUNT(*) / 2 AS half FROM filtered`, params)
    const halfCount = halfRow?.half ?? 0
    let previousWinRate: number | null = null
    if (halfCount > 0) {
      const older = await this.get<{ games: number; wins: number }>(`${base}
        SELECT COUNT(*) AS games, SUM(won) AS wins FROM (
          SELECT *, ROW_NUMBER() OVER (ORDER BY played_at DESC) AS rn FROM filtered
        ) WHERE rn > ?`, [...params, halfCount])
      if (older && older.games > 0) previousWinRate = older.wins / older.games
    }

    const winRateDelta = previousWinRate !== null ? winRate - previousWinRate : null
    const insight = this.buildInsight(winRateDelta, bestHero)

    const lastImportRow = await this.get<{ finished_at: string | null }>(
      'SELECT finished_at FROM import_runs WHERE status IN (?, ?) ORDER BY id DESC LIMIT 1', ['completed', 'cancelled'])

    return {
      totalGames: games, totalWins: wins, winRate,
      mostPlayedHero: summary?.hero ?? null, heroStats: stats.map(toStat), mapStats: maps.map(toStat),
      availableMaps: availableMaps.map((row) => row.map_name),
      availableHeroes: availableHeroes.map((row) => row.hero_name),
      lastImportAt: lastImportRow?.finished_at ?? null,
      previousWinRate,
      winRateDelta,
      bestHero,
      insight,
    }
  }

  private buildInsight(delta: number | null, bestHero: { name: string; winRate: number } | null): DashboardInsight | null {
    if (delta === null) return { text: 'Play more games to see trends.', trend: 'flat' }
    const pct = Math.abs(Math.round(delta * 100))
    if (pct < 2) {
      const heroTip = bestHero ? ` ${bestHero.name} is your strongest hero at ${Math.round(bestHero.winRate * 100)}%.` : ''
      return { text: `Your performance has been steady.${heroTip}`, trend: 'flat' }
    }
    if (delta > 0) {
      return { text: `Your win rate is up ${pct}% recently. Keep it up!`, trend: 'up' }
    }
    return { text: `Your win rate dipped ${pct}% recently. Review your recent matches.`, trend: 'down' }
  }

  async getMatches(filters: DashboardFilters): Promise<{ matches: MatchRecord[]; total: number }> {
    const where: string[] = []
    const params: SqlParams = []
    if (filters.since) { where.push('played_at >= ?'); params.push(filters.since) }
    if (filters.map) { where.push('map_name = ?'); params.push(filters.map) }
    if (filters.hero) { where.push('hero_name = ?'); params.push(filters.hero) }
    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
    const countRow = await this.get<{ count: number }>(`SELECT COUNT(*) AS count FROM matches${whereClause}`, params)
    const total = countRow?.count ?? 0
    const limit = filters.lastGames && filters.lastGames > 0 ? ' LIMIT ?' : ''
    if (limit) params.push(filters.lastGames!)
    const rows = await this.all<{ source_path: string; played_at: string; game_mode: string; map_name: string; hero_name: string; won: number; party_size: number; imported_at: string }>(
      `SELECT source_path, played_at, game_mode, map_name, hero_name, won, party_size, imported_at FROM matches${whereClause} ORDER BY played_at DESC${limit}`, params,
    )
    const matches: MatchRecord[] = rows.map((row) => ({
      sourcePath: row.source_path,
      playedAt: row.played_at,
      gameMode: row.game_mode,
      mapName: row.map_name,
      heroName: row.hero_name,
      won: Boolean(row.won),
      partySize: row.party_size,
      importedAt: row.imported_at,
    }))
    return { matches, total }
  }

  async getHeatmapData(filters: DashboardFilters): Promise<HeatmapData> {
    const where: string[] = []
    const params: SqlParams = []
    if (filters.gameMode) { where.push('game_mode = ?'); params.push(filters.gameMode) }
    if (filters.since) { where.push('played_at >= ?'); params.push(filters.since) }
    const limit = filters.lastGames && filters.lastGames > 0 ? ' LIMIT ?' : ''
    if (limit) params.push(filters.lastGames!)
    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
    const base = `WITH filtered AS (SELECT * FROM matches${whereClause} ORDER BY played_at DESC${limit})`
    const rows = await this.all<{ hero_name: string; map_name: string; games_played: number; games_won: number }>(
      `${base} SELECT hero_name, map_name, COUNT(*) AS games_played, SUM(won) AS games_won FROM filtered GROUP BY hero_name, map_name`, params,
    )
    const statsMap = new Map(rows.map((r) => [`${r.map_name}::${r.hero_name}`, r]))
    const modeClause = filters.gameMode ? ' WHERE game_mode = ?' : ''
    const modeParams = filters.gameMode ? [filters.gameMode] : []
    const allHeroes = await this.all<{ hero_name: string }>(`SELECT DISTINCT hero_name FROM matches${modeClause} ORDER BY hero_name`, modeParams)
    const allMaps = await this.all<{ map_name: string }>(`SELECT DISTINCT map_name FROM matches${modeClause} ORDER BY map_name`, modeParams)
    const heroes = allHeroes.map((r) => r.hero_name)
    const maps = allMaps.map((r) => r.map_name)
    const cells: HeatmapCell[] = []
    for (const map of maps) {
      for (const hero of heroes) {
        const stat = statsMap.get(`${map}::${hero}`)
        cells.push({
          hero,
          map,
          winRate: stat && stat.games_played > 0 ? stat.games_won / stat.games_played : null,
          gamesPlayed: stat?.games_played ?? 0,
        })
      }
    }
    return { cells, heroes, maps }
  }

  async getTrendData(filters: DashboardFilters): Promise<TrendPoint[]> {
    const where: string[] = []
    const params: SqlParams = []
    if (filters.gameMode) { where.push('game_mode = ?'); params.push(filters.gameMode) }
    if (filters.since) { where.push('played_at >= ?'); params.push(filters.since) }
    const limit = filters.lastGames && filters.lastGames > 0 ? ' LIMIT ?' : ''
    if (limit) params.push(filters.lastGames!)
    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
    const base = `WITH filtered AS (SELECT * FROM matches${whereClause} ORDER BY played_at DESC${limit})`
    const rows = await this.all<{ game_date: string; games_played: number; daily_winrate: number; aggregate_winrate: number }>(
      `${base}, daily AS (
        SELECT DATE(played_at) AS game_date, COUNT(*) AS games_played, SUM(won) AS games_won
        FROM filtered GROUP BY DATE(played_at) ORDER BY game_date
      )
      SELECT game_date, games_played,
        games_won * 1.0 / games_played AS daily_winrate,
        SUM(games_won) OVER (ORDER BY game_date) * 1.0
          / SUM(games_played) OVER (ORDER BY game_date) AS aggregate_winrate
      FROM daily`, params,
    )
    return rows.map((r) => ({
      date: r.game_date,
      dailyWinRate: r.daily_winrate,
      aggregateWinRate: r.aggregate_winrate,
      gamesPlayed: r.games_played,
    }))
  }

  async getPartyData(filters: DashboardFilters): Promise<PartySizeStat[]> {
    const where: string[] = []
    const params: SqlParams = []
    if (filters.gameMode) { where.push('game_mode = ?'); params.push(filters.gameMode) }
    if (filters.since) { where.push('played_at >= ?'); params.push(filters.since) }
    const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
    const rows = await this.all<{ party_size: number; wins: number; losses: number }>(
      `SELECT party_size, SUM(won) AS wins, COUNT(*) - SUM(won) AS losses
      FROM matches${whereClause}
      GROUP BY party_size ORDER BY party_size`, params,
    )
    return rows.map((r) => ({
      partySize: r.party_size,
      wins: r.wins,
      losses: r.losses,
      winRate: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
    }))
  }

  async getDraftData(filters: DashboardFilters): Promise<DraftHeroScore[]> {
    if (!filters.map) return []
    const sinceParams: SqlParams = []
    const modeClause = filters.gameMode ? ' AND game_mode = ?' : ''
    if (filters.gameMode) sinceParams.push(filters.gameMode)
    const sinceClause = filters.since ? ' AND played_at >= ?' : ''
    if (filters.since) sinceParams.push(filters.since)

    const overallRows = await this.all<{ hero_name: string; overall_games: number; overall_wins: number }>(
      `SELECT hero_name, COUNT(*) AS overall_games, SUM(won) AS overall_wins
      FROM matches WHERE 1=1${modeClause}${sinceClause}
      GROUP BY hero_name`, sinceParams,
    )

    const mapParams: SqlParams = [filters.map, ...sinceParams]
    const mapRows = await this.all<{ hero_name: string; map_games: number; map_wins: number }>(
      `SELECT hero_name, COUNT(*) AS map_games, SUM(won) AS map_wins
      FROM matches WHERE map_name = ?${modeClause}${sinceClause}
      GROUP BY hero_name`, mapParams,
    )

    const recentRows = await this.all<{ hero_name: string; recent_games: number; recent_wins: number }>(
      `SELECT hero_name, COUNT(*) AS recent_games, SUM(won) AS recent_wins
      FROM (
        SELECT hero_name, won,
          ROW_NUMBER() OVER (PARTITION BY hero_name ORDER BY played_at DESC) AS rn
        FROM matches WHERE 1=1${modeClause}${sinceClause}
      ) WHERE rn <= 5
      GROUP BY hero_name`, sinceParams,
    )

    const dotRows = await this.all<{ hero_name: string; won: number; rn: number }>(
      `SELECT hero_name, won, rn
      FROM (
        SELECT hero_name, won,
          ROW_NUMBER() OVER (PARTITION BY hero_name ORDER BY played_at DESC) AS rn
        FROM matches WHERE 1=1${modeClause}${sinceClause}
      ) WHERE rn <= 5
      ORDER BY hero_name, rn`, sinceParams,
    )

    const mapMap = new Map(mapRows.map((r) => [r.hero_name, r]))
    const recentMap = new Map(recentRows.map((r) => [r.hero_name, r]))
    const dotsMap = new Map<string, boolean[]>()
    for (const row of dotRows) {
      const arr = dotsMap.get(row.hero_name) ?? []
      arr.push(Boolean(row.won))
      dotsMap.set(row.hero_name, arr)
    }

    const confidenceBonus = (games: number): number => {
      if (games >= 21) return 1.0
      if (games >= 11) return 0.8
      if (games >= 6) return 0.6
      if (games >= 3) return 0.4
      if (games >= 1) return 0.2
      return 0.0
    }

    const scores: DraftHeroScore[] = overallRows.map((o) => {
      const m = mapMap.get(o.hero_name)
      const r = recentMap.get(o.hero_name)
      const mapGames = m?.map_games ?? 0
      const mapWins = m?.map_wins ?? 0
      const mapWinRate = mapGames > 0 ? mapWins / mapGames : 0
      const overallGames = o.overall_games
      const overallWins = o.overall_wins
      const overallWinRate = overallGames > 0 ? overallWins / overallGames : 0
      const recentGames = r?.recent_games ?? 0
      const recentWins = r?.recent_wins ?? 0
      const recentWinRate = recentGames > 0 ? recentWins / recentGames : 0
      const recentForm = dotsMap.get(o.hero_name) ?? []
      const bonus = confidenceBonus(mapGames)
      const compositeScore = (mapWinRate * 0.50) + (recentWinRate * 0.25) + (overallWinRate * 0.15) + (bonus * 0.10)
      const confidence = mapGames >= 11 ? 'high' : mapGames >= 3 ? 'medium' : 'low'
      return {
        heroName: o.hero_name,
        mapGames, mapWins, mapWinRate,
        overallGames, overallWins, overallWinRate,
        recentGames, recentWins, recentWinRate,
        recentForm, compositeScore, confidence,
      }
    })

    scores.sort((a, b) => b.compositeScore - a.compositeScore)
    return scores
  }

  close(): void { this.db.close() }

  async clearMatches(): Promise<void> {
    await this.run('DELETE FROM matches')
  }

  async insertMatchBatch(matches: MatchInput[]): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0
    let skipped = 0
    const stmt = `INSERT OR IGNORE INTO matches(id, source_path, played_at, game_mode, map_name, hero_name, won, party_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    await this.run('BEGIN')
    try {
      for (const match of matches) {
        const result = await new Promise<boolean>((resolve, reject) => {
          this.db.run(stmt, [
            match.id, match.sourcePath, match.playedAt, match.gameMode, match.mapName,
            match.heroName, match.won ? 1 : 0, match.partySize,
          ], function (this: sqlite3.RunResult, error) {
            if (error) return reject(error)
            resolve(this.changes > 0)
          })
        })
        if (result) inserted++
        else skipped++
      }
      await this.run('COMMIT')
    } catch (error) {
      await this.run('ROLLBACK')
      throw error
    }
    return { inserted, skipped }
  }

  async hasMatchBatch(sourcePaths: string[]): Promise<Set<string>> {
    if (sourcePaths.length === 0) return new Set()
    const placeholders = sourcePaths.map(() => '?').join(',')
    const rows = await this.all<{ source_path: string }>(
      `SELECT source_path FROM matches WHERE source_path IN (${placeholders})`, sourcePaths,
    )
    return new Set(rows.map((r) => r.source_path))
  }

  async createImportRun(folderPath: string): Promise<number> {
    const now = new Date().toISOString()
    await this.run(
      'INSERT INTO import_runs(folder_path, started_at, status) VALUES (?, ?, ?)',
      [folderPath, now, 'running'],
    )
    const row = await this.get<{ id: number }>('SELECT last_insert_rowid() AS id')
    return row!.id
  }

  async updateImportRun(
    id: number,
    update: { finishedAt?: string; totalFiles?: number; imported?: number; skipped?: number; failed?: number; status?: ImportRun['status'] },
  ): Promise<void> {
    const sets: string[] = []
    const params: SqlParams = []
    if (update.finishedAt !== undefined) { sets.push('finished_at = ?'); params.push(update.finishedAt) }
    if (update.totalFiles !== undefined) { sets.push('total_files = ?'); params.push(update.totalFiles) }
    if (update.imported !== undefined) { sets.push('imported = ?'); params.push(update.imported) }
    if (update.skipped !== undefined) { sets.push('skipped = ?'); params.push(update.skipped) }
    if (update.failed !== undefined) { sets.push('failed = ?'); params.push(update.failed) }
    if (update.status !== undefined) { sets.push('status = ?'); params.push(update.status) }
    if (sets.length === 0) return
    params.push(id)
    await this.run(`UPDATE import_runs SET ${sets.join(', ')} WHERE id = ?`, params)
  }
}
