import { describe, it, expect } from 'vitest'
import { isOwner, normaliseReplay } from '../src/main/importer'
import type { DecodedPlayer, DecodedReplay } from '../src/shared/parser'

describe('isOwner', () => {
  it('matches number to number', () => {
    expect(isOwner({ PlayerToonId: 123 }, 123)).toBe(true)
  })

  it('matches string to string', () => {
    expect(isOwner({ PlayerToonId: 'abc' }, 'abc')).toBe(true)
  })

  it('coerces number to string', () => {
    expect(isOwner({ PlayerToonId: 123 }, '123')).toBe(true)
  })

  it('returns false on mismatch', () => {
    expect(isOwner({ PlayerToonId: 1 }, 2)).toBe(false)
  })

  it('returns false when owner is undefined', () => {
    expect(isOwner({ PlayerToonId: 1 }, undefined)).toBe(false)
  })
})

function makeReplay(overrides: Partial<DecodedReplay> = {}): DecodedReplay {
  return {
    RandomValue: 'rv1',
    Timestamp: '2026-07-22T20:00:00Z',
    GameMode: 'stormLeague',
    ReplayOwner: 100,
    MapInfo: { MapName: 'AlteracPass' },
    Players: [
      { PlayerToonId: 100, PlayerHero: { HeroName: 'Genji', HeroId: 'Genji' }, IsWinner: true, Team: 0, PartyValue: null },
    ],
    ...overrides,
  }
}

describe('normaliseReplay', () => {
  it('happy path produces valid MatchInput', () => {
    const result = normaliseReplay('/test.StormReplay', makeReplay())
    expect(result).toMatchObject({
      sourcePath: '/test.StormReplay',
      playedAt: '2026-07-22T20:00:00Z',
      gameMode: 'stormLeague',
      mapName: 'AlteracPass',
      heroName: 'Genji',
      won: true,
      partySize: 1,
    })
  })

  it('throws when no owner identified', () => {
    expect(() => normaliseReplay('/test.StormReplay', makeReplay({ ReplayOwner: 999 })))
      .toThrow('does not identify its owner')
  })

  it('throws when metadata is missing', () => {
    expect(() => normaliseReplay('/test.StormReplay', makeReplay({ Timestamp: undefined })))
      .toThrow('missing match metadata')
  })

  it('throws when GameMode is missing', () => {
    expect(() => normaliseReplay('/test.StormReplay', makeReplay({ GameMode: undefined })))
      .toThrow('missing match metadata')
  })

  it('normalizes gameMode first char to lowercase', () => {
    const result = normaliseReplay('/test.StormReplay', makeReplay({ GameMode: 'StormLeague' }))
    expect(result.gameMode).toBe('stormLeague')
  })

  it('falls back to HeroId when HeroName missing', () => {
    const replay = makeReplay({ Players: [{ PlayerToonId: 100, PlayerHero: { HeroId: 'FallbackHero' }, IsWinner: true, Team: 0, PartyValue: null }] })
    const result = normaliseReplay('/test.StormReplay', replay)
    expect(result.heroName).toBe('FallbackHero')
  })

  it('falls back to MapId when MapName missing', () => {
    const result = normaliseReplay('/test.StormReplay', makeReplay({ MapInfo: { MapId: 'FallbackMap' } }))
    expect(result.mapName).toBe('FallbackMap')
  })

  it('party size is 1 for solo (PartyValue null)', () => {
    const result = normaliseReplay('/test.StormReplay', makeReplay())
    expect(result.partySize).toBe(1)
  })

  it('party size counts teammates with same PartyValue and Team', () => {
    const replay = makeReplay({
      Players: [
        { PlayerToonId: 100, PlayerHero: { HeroName: 'Genji' }, IsWinner: true, Team: 0, PartyValue: 'party-A' },
        { PlayerToonId: 101, PlayerHero: { HeroName: 'Jaina' }, IsWinner: true, Team: 0, PartyValue: 'party-A' },
        { PlayerToonId: 102, PlayerHero: { HeroName: 'ETC' }, IsWinner: true, Team: 0, PartyValue: 'party-A' },
      ],
    })
    const result = normaliseReplay('/test.StormReplay', replay)
    expect(result.partySize).toBe(3)
  })

  it('party size excludes cross-team players with same PartyValue', () => {
    const replay = makeReplay({
      Players: [
        { PlayerToonId: 100, PlayerHero: { HeroName: 'Genji' }, IsWinner: true, Team: 0, PartyValue: 'party-A' },
        { PlayerToonId: 101, PlayerHero: { HeroName: 'Valla' }, IsWinner: false, Team: 1, PartyValue: 'party-A' },
      ],
    })
    const result = normaliseReplay('/test.StormReplay', replay)
    expect(result.partySize).toBe(1)
  })

  it('uses RandomValue for id when present', () => {
    const result = normaliseReplay('/test.StormReplay', makeReplay({ RandomValue: 'abc123' }))
    expect(result.id).toBe('abc123')
  })

  it('hashes sourcePath for id when RandomValue absent', () => {
    const result = normaliseReplay('/test.StormReplay', makeReplay({ RandomValue: undefined }))
    expect(result.id).toBeTypeOf('string')
    expect(result.id.length).toBe(64) // sha256 hex
  })

  it('won is true when IsWinner is true', () => {
    expect(normaliseReplay('/t.StormReplay', makeReplay()).won).toBe(true)
  })

  it('won is false when IsWinner is false', () => {
    const replay = makeReplay({
      Players: [{ PlayerToonId: 100, PlayerHero: { HeroName: 'Genji' }, IsWinner: false, Team: 0, PartyValue: null }],
    })
    expect(normaliseReplay('/t.StormReplay', replay).won).toBe(false)
  })
})
