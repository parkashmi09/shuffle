export type ExecutiveRow = {
  id: number
  username: string
  kind: 'executive' | 'marketing'
  status: 'active' | 'inactive' | 'locked'
  parentStaffId: number | null
  parentRoleAtCreation: number | null
  permissions: string[]
  lastLogin: string | null
}

export type ExecutiveActivity = {
  id: number
  executiveId: number
  action: string
  targetType: string | null
  targetId: string | null
  details: Record<string, unknown> | null
  ip: string | null
  status: string | null
  error: string | null
  createdAt: string | null
}

export const EXECUTIVE_STATUSES = ['active', 'inactive', 'locked'] as const

/** The platform permission vocabulary — `backend/packages/auth/src/permissions.js`. */
export const PERMISSION_GROUPS: { label: string; permissions: string[] }[] = [
  { label: 'Users', permissions: ['users:read', 'users:write', 'users:lock', 'users:delete', 'users:impersonate'] },
  { label: 'Wallet', permissions: ['wallet:read', 'wallet:credit', 'wallet:debit', 'wallet:adjust'] },
  { label: 'Payments', permissions: ['deposits:read', 'deposits:approve', 'withdrawals:read', 'withdrawals:approve'] },
  { label: 'Casino', permissions: ['casino:read', 'casino:manage', 'casino:settle'] },
  { label: 'Sports', permissions: ['sports:read', 'sports:manage', 'sports:settle', 'sports:void-settled'] },
  { label: 'Admin', permissions: ['staff:read', 'staff:write', 'roles:manage', 'config:read', 'config:write', 'reports:read', 'audit:read'] }
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions)
