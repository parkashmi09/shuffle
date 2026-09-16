'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { api, request } from '@/lib/api/client'

export type Actor = {
  staffId: number
  roleId: number
  roleName: string
  level: number
  executiveId: number | null
  permissions: string[]
  expiresAt: string
  name?: string
  email?: string
}

/** The operator feature flags — `GET admin/site-config/global`. Keys are the platform's columns. */
export type SiteFlags = Record<string, boolean>

type SessionValue = {
  actor: Actor | null
  loading: boolean
  /** `resource:action` → does the current role hold it (exact, `resource:*`, or `*`). */
  can: (permission?: string | string[]) => boolean
  flags: SiteFlags
  flagsLoading: boolean
  refreshFlags: () => void
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function hasPermission(granted: string[] | undefined, required: string): boolean {
  if (!granted?.length) return false
  if (granted.includes('*') || granted.includes(required)) return true
  const [resource] = required.split(':')

  return granted.includes(`${resource}:*`)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()

  const me = useQuery<Actor>({
    queryKey: ['session', 'me'],
    queryFn: () => request<Actor>('/api/auth/me', { raw: true }).then(r => r.data),
    staleTime: 60_000,
    retry: false
  })

  const flags = useQuery<SiteFlags>({
    queryKey: ['api', 'admin/site-config/global', null],
    queryFn: () => api.get<SiteFlags>('admin/site-config/global'),
    enabled: !!me.data && hasPermission(me.data.permissions, 'config:read'),
    staleTime: 30_000
  })

  const can = useCallback(
    (permission?: string | string[]) => {
      if (!permission || (Array.isArray(permission) && permission.length === 0)) return true
      const list = Array.isArray(permission) ? permission : [permission]

      return list.some(p => hasPermission(me.data?.permissions, p))
    },
    [me.data]
  )

  const signOut = useCallback(async () => {
    await request('/api/auth/logout', { raw: true, method: 'POST', body: {} }).catch(() => undefined)
    qc.clear()
    location.assign('/login')
  }, [qc])

  const value = useMemo<SessionValue>(
    () => ({
      actor: me.data ?? null,
      loading: me.isLoading,
      can,
      flags: flags.data ?? {},
      flagsLoading: flags.isLoading,
      refreshFlags: () => void qc.invalidateQueries({ queryKey: ['api', 'admin/site-config/global'] }),
      signOut
    }),
    [me.data, me.isLoading, can, flags.data, flags.isLoading, qc, signOut]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const ctx = useContext(SessionContext)

  if (!ctx) throw new Error('useSession must be used inside SessionProvider')

  return ctx
}
