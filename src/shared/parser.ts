export interface DecodedPlayer {
  PlayerToonId?: string | number
  PlayerHero?: { HeroName?: string; HeroId?: string }
  IsWinner?: boolean
  Team?: number
  PartyValue?: string | number
}

export interface DecodedReplay {
  RandomValue?: string | number
  Timestamp?: string
  GameMode?: string
  ReplayOwner?: string | number
  MapInfo?: { MapName?: string; MapId?: string }
  Players?: DecodedPlayer[]
}

