export type StaffRow = {
  id: number
  name: string
  email: string
  phone: string | null
  country: string | null
  parentId: number | null
  roleId: number
  status: string
  percentage: string
}

export type StaffNode = StaffRow & { children: StaffNode[] }

export const ROLE_NAMES: Record<number, string> = {
  1: 'Super Admin',
  2: 'Admin',
  3: 'Sub Admin',
  4: 'Super Master',
  5: 'Master',
  6: 'Agent',
  7: 'Executive'
}

export const STAFF_STATUSES = ['active', 'suspended', 'inactive'] as const
