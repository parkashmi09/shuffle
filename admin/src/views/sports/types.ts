/** Row shapes for the sports area. `GAME_TYPE` is MO (match odds), BM (bookmaker), FAN (fancy). */

export const GAME_TYPES = ['MO', 'BM', 'FAN'] as const
export type GameType = (typeof GAME_TYPES)[number]

export const GAME_TYPE_LABELS: Record<string, string> = { MO: 'Match odds', BM: 'Bookmaker', FAN: 'Fancy' }

/** The platform's own three: a bet is open, settled manually, or closed. */
export const BET_STATUSES = ['open', 'manual', 'closed'] as const

export type SportsBet = Record<string, unknown> & {
  id: number
  userId?: number | string
  username?: string
  matchId?: string
  matchTitle?: string
  marketType?: string
  gameType?: string
  selectionName?: string
  side?: string
  odds?: string | number
  stake?: string
  liability?: string
  payout?: string
  status?: string
  resultStatus?: string
  createdAt?: string
  placedAt?: string
}

export type Exposure = Record<string, unknown> & {
  userId?: number | string
  username?: string
  exposure?: string
  liability?: string
  openBets?: number
}

export type SettlementMatch = Record<string, unknown> & {
  match_id?: string
  matchId?: string
  eventid?: string
  eventId?: string
  match_title?: string
  matchTitle?: string
  market_type?: string
  marketType?: string
  game_type?: string
  gameType?: string
  openBets?: number
  bets?: number
}

export type SettledMarket = SettlementMatch & { settledAt?: string; settled_at?: string; winnerName?: string; winner_name?: string }

export type SportRow = { id: number; gameId: number; gameName: string; enabled: boolean }

export type FancyControl = {
  id?: number
  eventId: string
  eventName?: string | null
  marketId: string
  marketName?: string | null
  showFancy: boolean
  updatedAt?: string
}

export type MarketResult = Record<string, unknown> & {
  id?: number
  matchId?: string
  match_id?: string
  matchTitle?: string
  marketType?: string
  market_type?: string
  winnerName?: string
  winner_name?: string
  userId?: number | string
  username?: string
  amount?: string
  createdAt?: string
}
