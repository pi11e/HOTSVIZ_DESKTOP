import { DatabaseService, type MatchInput } from '../src/main/database'

let dbCounter = 0

export async function createTestDb(): Promise<DatabaseService> {
  const db = new DatabaseService(':memory:')
  await db.initialize()
  return db
}

export function makeMatch(overrides: Partial<MatchInput> = {}): MatchInput {
  dbCounter++
  return {
    id: `test-${dbCounter}`,
    sourcePath: `C:\\replays\\test${dbCounter}.StormReplay`,
    playedAt: '2026-07-22T20:00:00Z',
    gameMode: 'stormLeague',
    mapName: 'AlteracPass',
    heroName: 'Genji',
    won: true,
    partySize: 1,
    ...overrides,
  }
}

export function resetCounter(): void {
  dbCounter = 0
}
