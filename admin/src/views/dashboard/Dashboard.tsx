'use client'

import type { ReactNode } from 'react'

import Link from 'next/link'

import { ArrowDownToLineIcon, ArrowUpFromLineIcon, ScaleIcon, UserPlusIcon, UsersIcon } from 'lucide-react'

import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useApi, usePagedApi } from '@/hooks/use-api'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

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
type Movement = Record<string, unknown> & {
  id?: number | string
  kind?: string
  source?: string
  userId?: number
  username?: string
  amount?: string
  currency?: string
  status?: string
  createdAt?: string
  created?: string
}
type Registration = Record<string, unknown> & {
  id: number | string
  username?: string
  name?: string
  email?: string
  country?: string
  created?: string
  createdAt?: string
}

/** Status colour is meaning, never decoration: green = done, amber = waiting, red = gone wrong. */
const STATUS_TONES: Record<string, string> = {
  completed: 'bg-success-soft text-success',
  complete: 'bg-success-soft text-success',
  approved: 'bg-success-soft text-success',
  settled: 'bg-success-soft text-success',
  success: 'bg-success-soft text-success',
  successful: 'bg-success-soft text-success',
  paid: 'bg-success-soft text-success',
  confirmed: 'bg-success-soft text-success',
  pending: 'bg-warning-soft text-warning',
  processing: 'bg-warning-soft text-warning',
  submitted: 'bg-warning-soft text-warning',
  open: 'bg-warning-soft text-warning',
  review: 'bg-warning-soft text-warning',
  failed: 'bg-danger-soft text-danger',
  rejected: 'bg-danger-soft text-danger',
  cancelled: 'bg-danger-soft text-danger',
  canceled: 'bg-danger-soft text-danger',
  declined: 'bg-danger-soft text-danger',
  expired: 'bg-danger-soft text-danger'
}

const Pill = ({ value, className }: { value: string | null | undefined; className?: string }) => {
  if (value === null || value === undefined || value === '') return <span className='text-muted-foreground'>—</span>

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize',
        className
      )}
    >
      {String(value).replace(/[_-]+/g, ' ')}
    </span>
  )
}

const StatusPill = ({ value }: { value: string | null | undefined }) => (
  <Pill value={value} className={STATUS_TONES[String(value ?? '').toLowerCase()] ?? 'bg-muted text-muted-foreground'} />
)

const SectionHeading = ({ title, description }: { title: string; description: string }) => (
  <div>
    <h2 className='text-sm font-medium'>{title}</h2>
    <p className='text-muted-foreground mt-0.5 text-xs'>{description}</p>
  </div>
)

const Tile = ({
  label,
  value,
  unit,
  hint,
  icon,
  loading
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
}) => (
  <div className='bg-card border-border flex items-start justify-between gap-3 rounded-xl border p-4'>
    <div className='min-w-0'>
      <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>{label}</p>
      {loading ? (
        <Skeleton className='mt-2 h-7 w-24' />
      ) : (
        <div className='mt-1.5 flex items-baseline gap-1.5'>
          <span className='truncate text-2xl leading-tight font-semibold tabular-nums'>{value}</span>
          {unit && <span className='text-muted-foreground text-xs font-medium'>{unit}</span>}
        </div>
      )}
      {hint && <p className='text-muted-foreground mt-1 text-xs'>{hint}</p>}
    </div>
    {icon && <span className='text-muted-foreground shrink-0 [&_svg]:size-4'>{icon}</span>}
  </div>
)

const movementColumns: Column<Movement>[] = [
  {
    key: 'kind',
    header: 'Kind',
    cell: r => <Pill value={String(r.kind ?? r.source ?? '')} className='bg-muted text-foreground' />
  },
  {
    key: 'user',
    header: 'Player',
    cell: r => (
      <Link className='font-medium hover:underline' href={`/players/${r.userId ?? ''}`}>
        {String(r.username ?? r.userId ?? '—')}
      </Link>
    )
  },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
  { key: 'status', header: 'Status', cell: r => <StatusPill value={r.status} /> },
  {
    key: 'at',
    header: 'When',
    cell: r => (
      <span className='text-muted-foreground'>
        <DateTime value={(r.createdAt ?? r.created) as string} relative />
      </span>
    )
  }
]

const registrationColumns: Column<Registration>[] = [
  {
    key: 'name',
    header: 'Player',
    cell: r => (
      <Link className='font-medium hover:underline' href={`/players/${r.id}`}>
        {String(r.username ?? r.name ?? r.id)}
      </Link>
    )
  },
  { key: 'email', header: 'Email', cell: r => <span className='text-muted-foreground'>{String(r.email ?? '—')}</span> },
  {
    key: 'country',
    header: 'Country',
    cell: r => <span className='font-mono text-xs tracking-wide uppercase'>{String(r.country ?? '—')}</span>
  },
  {
    key: 'at',
    header: 'Registered',
    cell: r => (
      <span className='text-muted-foreground'>
        <DateTime value={(r.createdAt ?? r.created) as string} relative />
      </span>
    )
  }
]

const Dashboard = () => {
  const overview = useApi<Overview>('admin/dashboard')
  const stats = useApi<UserStats>('admin/dashboard/user-stats')
  const movements = usePagedApi<Movement>('admin/dashboard/movements', { limit: 8 })
  const registrations = usePagedApi<Registration>('admin/dashboard/registrations', { limit: 8 })
  const o = overview.data
  const loading = overview.isLoading
  const countries = (stats.data?.topCountries ?? []).slice(0, 8)
  const topCount = Math.max(...countries.map(c => c.count), 1)

  return (
    <div>
      <PageHeader title='Dashboard' description={o?.valuation.note} />

      <div className='flex flex-col gap-6'>
        {overview.error && <ErrorState error={overview.error} />}

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5'>
          <Tile
            label='Players'
            value={formatNumber(o?.users.total)}
            unit='players'
            hint={`${formatNumber(o?.users.newToday)} new today`}
            icon={<UsersIcon />}
            loading={loading}
          />
          <Tile
            label='Deposits today'
            value={<Money value={o?.deposits.today.usd} />}
            unit='USD'
            hint={`${formatNumber(o?.deposits.today.count)} txns · lifetime ${formatNumber(o?.deposits.lifetime.count)}`}
            icon={<ArrowDownToLineIcon />}
            loading={loading}
          />
          <Tile
            label='Withdrawals today'
            value={<Money value={o?.withdrawals.today.usd} />}
            unit='USD'
            hint={`${formatNumber(o?.withdrawals.today.count)} txns · lifetime ${formatNumber(o?.withdrawals.lifetime.count)}`}
            icon={<ArrowUpFromLineIcon />}
            loading={loading}
          />
          <Tile
            label='Net today'
            value={<Money value={o?.net.today} signed />}
            unit='USD'
            hint={
              <>
                lifetime <Money value={o?.net.lifetime} currency='USD' signed />
              </>
            }
            icon={<ScaleIcon />}
            loading={loading}
          />
          <Tile
            label='Registered (30d)'
            value={formatNumber(stats.data?.registeredLast30Days)}
            unit='players'
            hint={`${formatNumber(stats.data?.registeredPrevious30Days)} previous 30d · ${formatNumber(stats.data?.verified)} verified`}
            icon={<UserPlusIcon />}
            loading={stats.isLoading}
          />
        </div>

        <div className='grid gap-6 xl:grid-cols-3'>
          <section className='flex flex-col gap-3 xl:col-span-2'>
            <SectionHeading
              title='Latest money movements'
              description='The most recent deposits and withdrawals across the site.'
            />
            <DataTable
              columns={movementColumns}
              rows={movements.data?.rows}
              rowKey={(r, i) => String(r.id ?? i)}
              loading={movements.isLoading}
              error={movements.error}
              emptyMessage='No deposits or withdrawals yet.'
              dense
            />
          </section>
          <section className='flex flex-col gap-3'>
            <SectionHeading title='Top countries' description='Where registrations are coming from.' />
            <div className='bg-card border-border rounded-xl border p-4'>
              {stats.isLoading && !stats.data ? (
                <div className='grid gap-3'>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={`c${i}`} className='h-4 w-full' />
                  ))}
                </div>
              ) : countries.length > 0 ? (
                <div className='grid gap-3'>
                  {countries.map(c => (
                    <div key={c.country} className='grid gap-1.5'>
                      <div className='flex items-baseline justify-between gap-3 text-sm'>
                        <span className='font-mono text-xs tracking-wide uppercase'>{c.country || '—'}</span>
                        <span className='tabular-nums'>{formatNumber(c.count)}</span>
                      </div>
                      <div className='bg-muted h-1 overflow-hidden rounded-full'>
                        <div
                          className='bg-primary h-full rounded-full'
                          style={{ width: `${Math.max((c.count / topCount) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-muted-foreground text-sm'>No registrations yet.</p>
              )}
            </div>
          </section>
        </div>

        <section className='flex flex-col gap-3'>
          <SectionHeading title='Recent registrations' description='Players who signed up most recently.' />
          <DataTable
            columns={registrationColumns}
            rows={registrations.data?.rows}
            rowKey={r => String(r.id)}
            loading={registrations.isLoading}
            error={registrations.error}
            dense
          />
        </section>
      </div>
    </div>
  )
}

export default Dashboard
