'use client'

import Link from 'next/link'

import { ArrowDownToLineIcon, ArrowUpFromLineIcon, ScaleIcon, UserPlusIcon, UsersIcon } from 'lucide-react'

import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useApi, usePagedApi } from '@/hooks/use-api'
import { formatNumber } from '@/lib/format'

type Totals = { usd: string; count: number; byCurrency: { currency: string; amount: string; count: number }[] }
type Overview = {
  users: { total: number; newToday: number }
  deposits: { lifetime: Totals; today: Totals }
  withdrawals: { lifetime: Totals; today: Totals }
  net: { today: string; lifetime: string }
  valuation: { currency: string; note: string; ratesAsOf: string | null }
}
type UserStats = {
  total: number
  newToday: number
  registeredLast30Days: number
  registeredPrevious30Days: number
  verified: number
  topCountries: { country: string; count: number }[]
  registrationTrend: { date: string; count: number }[]
}
type Movement = Record<string, unknown> & { id?: number | string; kind?: string; source?: string; userId?: number; username?: string; amount?: string; currency?: string; status?: string; createdAt?: string; created?: string }
type Registration = Record<string, unknown> & { id: number | string; username?: string; name?: string; email?: string; country?: string; created?: string; createdAt?: string }

const movementColumns: Column<Movement>[] = [
  { key: 'kind', header: 'Kind', cell: r => <StatusBadge value={String(r.kind ?? r.source ?? '')} /> },
  { key: 'user', header: 'Player', cell: r => <Link className='hover:underline' href={`/players/${r.userId ?? ''}`}>{String(r.username ?? r.userId ?? '—')}</Link> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'at', header: 'When', cell: r => <DateTime value={(r.createdAt ?? r.created) as string} relative /> }
]

const registrationColumns: Column<Registration>[] = [
  { key: 'name', header: 'Player', cell: r => <Link className='font-medium hover:underline' href={`/players/${r.id}`}>{String(r.username ?? r.name ?? r.id)}</Link> },
  { key: 'email', header: 'Email', cell: r => <span className='text-muted-foreground'>{String(r.email ?? '—')}</span> },
  { key: 'country', header: 'Country', cell: r => String(r.country ?? '—') },
  { key: 'at', header: 'Registered', cell: r => <DateTime value={(r.createdAt ?? r.created) as string} relative /> }
]

const Dashboard = () => {
  const overview = useApi<Overview>('admin/dashboard')
  const stats = useApi<UserStats>('admin/dashboard/user-stats')
  const movements = usePagedApi<Movement>('admin/dashboard/movements', { limit: 8 })
  const registrations = usePagedApi<Registration>('admin/dashboard/registrations', { limit: 8 })
  const o = overview.data
  const loading = overview.isLoading

  return (
    <div>
      <PageHeader title='Dashboard' description={o?.valuation.note} />

      {overview.error && <ErrorState error={overview.error} />}

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-5'>
        <StatCard label='Players' value={formatNumber(o?.users.total)} hint={`${formatNumber(o?.users.newToday)} new today`} icon={<UsersIcon />} loading={loading} />
        <StatCard label='Deposits today' value={<Money value={o?.deposits.today.usd} currency='USD' />} hint={`${formatNumber(o?.deposits.today.count)} txns · lifetime ${formatNumber(o?.deposits.lifetime.count)}`} icon={<ArrowDownToLineIcon />} loading={loading} />
        <StatCard label='Withdrawals today' value={<Money value={o?.withdrawals.today.usd} currency='USD' />} hint={`${formatNumber(o?.withdrawals.today.count)} txns · lifetime ${formatNumber(o?.withdrawals.lifetime.count)}`} icon={<ArrowUpFromLineIcon />} loading={loading} />
        <StatCard label='Net today' value={<Money value={o?.net.today} currency='USD' signed />} hint={<>lifetime <Money value={o?.net.lifetime} currency='USD' signed /></>} icon={<ScaleIcon />} loading={loading} />
        <StatCard label='Registered (30d)' value={formatNumber(stats.data?.registeredLast30Days)} hint={`${formatNumber(stats.data?.registeredPrevious30Days)} previous 30d · ${formatNumber(stats.data?.verified)} verified`} icon={<UserPlusIcon />} loading={stats.isLoading} />
      </div>

      <div className='mt-6 grid gap-6 xl:grid-cols-3'>
        <div className='xl:col-span-2'>
          <h2 className='mb-3 text-base font-semibold'>Latest money movements</h2>
          <DataTable columns={movementColumns} rows={movements.data?.rows} rowKey={(r, i) => String(r.id ?? i)} loading={movements.isLoading} error={movements.error} emptyMessage='No deposits or withdrawals yet.' dense />
        </div>
        <div>
          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle className='text-base'>Top countries</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-2'>
              {(stats.data?.topCountries ?? []).slice(0, 8).map(c => (
                <div key={c.country} className='flex items-center justify-between text-sm'>
                  <span className='font-mono'>{c.country || '—'}</span>
                  <span className='tabular-nums'>{formatNumber(c.count)}</span>
                </div>
              ))}
              {stats.data && stats.data.topCountries.length === 0 && <p className='text-muted-foreground text-sm'>No registrations yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className='mt-6'>
        <h2 className='mb-3 text-base font-semibold'>Recent registrations</h2>
        <DataTable columns={registrationColumns} rows={registrations.data?.rows} rowKey={r => String(r.id)} loading={registrations.isLoading} error={registrations.error} dense />
      </div>
    </div>
  )
}

export default Dashboard
