import { describe, it, expect, afterEach } from 'vitest'
import { createTestDb, makeMatch } from './helpers'
import type { DatabaseService } from '../src/main/database'

let db: DatabaseService

afterEach(() => {
  if (db) db.close()
})

describe('DatabaseService — settings', () => {
  it('setSetting and getSetting', async () => {
    db = await createTestDb()
    await db.setSetting('folder', '/my/replays')
    expect(await db.getSetting('folder')).toBe('/my/replays')
  })

  it('setSetting upserts', async () => {
    db = await createTestDb()
    await db.setSetting('key', 'v1')
    await db.setSetting('key', 'v2')
    expect(await db.getSetting('key')).toBe('v2')
  })

  it('getSetting returns null for nonexistent key', async () => {
    db = await createTestDb()
    expect(await db.getSetting('missing')).toBeNull()
  })
})

describe('DatabaseService — insertMatch', () => {
  it('returns true for a new match', async () => {
    db = await createTestDb()
    const result = await db.insertMatch(makeMatch({ id: 'm1', sourcePath: '/a.StormReplay' }))
    expect(result).toBe(true)
  })

  it('returns false for a duplicate source_path', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ id: 'm1', sourcePath: '/a.StormReplay' }))
    const result = await db.insertMatch(makeMatch({ id: 'm2', sourcePath: '/a.StormReplay' }))
    expect(result).toBe(false)
  })
})

describe('DatabaseService — hasMatch', () => {
  it('returns true for an inserted path', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ sourcePath: '/a.StormReplay' }))
    expect(await db.hasMatch('/a.StormReplay')).toBe(true)
  })

  it('returns false for an unknown path', async () => {
    db = await createTestDb()
    expect(await db.hasMatch('/unknown.StormReplay')).toBe(false)
  })
})

describe('DatabaseService — insertMatchBatch', () => {
  it('counts inserted and skipped correctly', async () => {
    db = await createTestDb()
    const batch = [
      makeMatch({ id: 'b1', sourcePath: '/1.StormReplay' }),
      makeMatch({ id: 'b2', sourcePath: '/2.StormReplay' }),
      makeMatch({ id: 'b3', sourcePath: '/1.StormReplay' }), // duplicate
    ]
    const result = await db.insertMatchBatch(batch)
    expect(result).toEqual({ inserted: 2, skipped: 1 })
  })

  it('handles empty input', async () => {
    db = await createTestDb()
    const result = await db.insertMatchBatch([])
    expect(result).toEqual({ inserted: 0, skipped: 0 })
  })
})

describe('DatabaseService — hasMatchBatch', () => {
  it('returns set of existing paths', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ sourcePath: '/a.StormReplay' }))
    await db.insertMatch(makeMatch({ sourcePath: '/b.StormReplay' }))
    const result = await db.hasMatchBatch(['/a.StormReplay', '/b.StormReplay', '/c.StormReplay'])
    expect(result).toEqual(new Set(['/a.StormReplay', '/b.StormReplay']))
  })

  it('returns empty set for empty input', async () => {
    db = await createTestDb()
    const result = await db.hasMatchBatch([])
    expect(result).toEqual(new Set())
  })
})

describe('DatabaseService — clearMatches', () => {
  it('empties the matches table', async () => {
    db = await createTestDb()
    await db.insertMatch(makeMatch({ sourcePath: '/a.StormReplay' }))
    await db.insertMatch(makeMatch({ sourcePath: '/b.StormReplay' }))
    await db.clearMatches()
    expect(await db.hasMatch('/a.StormReplay')).toBe(false)
    expect(await db.hasMatch('/b.StormReplay')).toBe(false)
  })
})

describe('DatabaseService — import runs', () => {
  it('createImportRun returns an auto-increment ID', async () => {
    db = await createTestDb()
    const id1 = await db.createImportRun('/replays')
    const id2 = await db.createImportRun('/replays')
    expect(id1).toBeTypeOf('number')
    expect(id2).toBe(id1 + 1)
  })

  it('updateImportRun applies partial updates', async () => {
    db = await createTestDb()
    const id = await db.createImportRun('/replays')
    await db.updateImportRun(id, { totalFiles: 10, imported: 8, skipped: 1, failed: 1, status: 'completed', finishedAt: new Date().toISOString() })
    const row = await db.get<{ total_files: number; imported: number; skipped: number; failed: number; status: string }>(
      'SELECT total_files, imported, skipped, failed, status FROM import_runs WHERE id = ?', [id],
    )
    expect(row).toEqual({ total_files: 10, imported: 8, skipped: 1, failed: 1, status: 'completed' })
  })

  it('updateImportRun with empty update is a no-op', async () => {
    db = await createTestDb()
    const id = await db.createImportRun('/replays')
    await db.updateImportRun(id, {})
    const row = await db.get<{ status: string }>('SELECT status FROM import_runs WHERE id = ?', [id])
    expect(row?.status).toBe('running')
  })
})
