export type PlayerRow = {
  id: string
  name: string
  avatar: string | null
  level: number
  status: string
  gamesPlayed: number
  referralCode: string
  channel: 'direct' | 'agent'
  agentId: number | null
  balance: string
  totalDeposited: string
  totalWithdrawn: string
  wager: string
  vip: { level: number; card: string; nextLevel: number; wagerToNextLevel: string; progressPct: string }
}
