export type PlayerReportRow = {
  id: string
  name: string
  avatar: string | null
  level: number
  status: string
  gamesPlayed: number
  referralCode: string | null
  channel: 'direct' | 'agent' | string
  agentId: number | null
  balance: string
  totalDeposited: string
  totalWithdrawn: string
  wager: string
  vip: { level: number; card: string; nextLevel: number; wagerToNextLevel: string; progressPct: string }
}

export type AgentUserRow = {
  id: string
  name: string
  email: string | null
  country: string | null
  phone: string | null
  isLocked: boolean
  sportsBetlocked: boolean
  staffId: string | null
  staffName: string | null
  staffEmail: string | null
  totalDeposit: string
  totalWithdrawal: string
  sportsPnl: string
  casinoPnl: string
  pnl: string
}

export type AgentStaffRow = {
  id: string
  name: string
  email: string | null
  roleId: number
  roleName: string
  roleLevel: number
  parentId: string | null
  parentName: string | null
  systemLocked: boolean
  sportsBetlocked: boolean
  createdAt: string | null
}

export type AgentUsersReport = {
  currency: string
  scope: { isSuperAdmin: boolean; staffId: number }
  total: number
  users: AgentUserRow[]
  staff: AgentStaffRow[]
}

/** `admin/accounts/statement` — one transfer between two accounts. */
export type TransferRow = {
  id: number
  from: { type: 'staff' | 'user'; id: string | number; name: string | null }
  to: { type: 'staff' | 'user'; id: string | number; name: string | null }
  amount: string
  direction: string | null
  transferType: string | null
  note: string | null
  createdAt: string | null
}

export type StatementBalance = Record<string, string> & {
  live: string
  opening: string
  closing: string
  movement: string
  totalIn: string
  totalOut: string
  openExposure: string
}

export type StatementRow = {
  id: string
  ts: string
  kind: string
  label: string
  party?: Record<string, unknown> | string | null
  note: string | null
  legacy: string | null
  amount: string
  balance?: string
}

export type Statement = {
  subject: { type: 'USER' | 'STAFF'; id: string; name: string; email: string | null; role: string; level: number | null; agentCode: string | null; parentName: string | null }
  period: { from: string | null; to: string | null }
  category: string
  balance: StatementBalance
  rows: StatementRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  gaming: {
    sports: Record<string, string | number>
    casino: Record<string, string | number>
    total: Record<string, string | number>
    counts: Record<string, number>
  }
  [k: string]: unknown
}

export type UserRisk = {
  currency: string
  user: Record<string, unknown> & { id: string; name: string; email: string | null; staffId: string | null; staffName: string | null; lastIp: string | null; lastLoginAt: string | null; twoFaEnabled: boolean }
  locks: Record<string, boolean>
  financials: { totalDeposit: string; totalWithdrawal: string; net: string }
  activity: { distinctIpCount: number; distinctIps: string[]; ipBreakdown: Record<string, unknown>[]; recentLogins: Record<string, unknown>[]; recentBets: Record<string, unknown>[] }
  riskFlags: Record<string, boolean>
}

export type StaffRisk = {
  currency: string
  staff: Record<string, unknown> & { id: string; name: string; email: string | null; roleName: string; parentName: string | null; balance: string; percentage: string }
  locks: Record<string, boolean>
  parentChain: { id: number; name: string; email: string; roleName: string; depth: number }[]
  downline: { directStaffCount: number; subtreeStaffCount: number; playersCount: number; lockedPlayers: number; totalDeposits: string; totalWithdrawals: string; net: string }
  riskFlags: Record<string, boolean>
}

export type Exposure = { total: number; rows: Record<string, unknown>[] }

export const STATEMENT_CATEGORIES = ['all', 'money', 'sports', 'casino'] as const
export const ACCOUNT_TYPES = ['user', 'staff'] as const
export const LOCK_KINDS = ['system', 'casino', 'sports'] as const

export const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000))

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
