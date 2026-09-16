'use client'

import { useEffect, useState } from 'react'

import { FlagIcon, PlusIcon, SaveIcon, Trash2Icon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import FormDialog from '@/components/shared/FormDialog'
import { SwitchField, TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'

/**
 * Wagering races (stake fork). A config per type decides the points a bet earns
 * per product, the pool and how it splits across ranks; a race is one window of
 * that config. Settling a race pays its rewards, so it is a confirm.
 */
type RaceType = 'daily' | 'weekly'

type RaceConfig = {
  type: RaceType
  enabled: boolean
  sportsPoints: number | string
  casinoPoints: number | string
  slotPoints: number | string
  crashPoints: number | string
  otherPoints: number | string
  prizePool: string
  currency?: string
  platformFeePercent: number | string
  winnerCount: number
  top3Percentage: number | string
  minPoints: string
  bookedSeatsEnabled: boolean
  bookedSeats?: number[]
  rankPercentage?: { rank: number; percentage: number; amount?: string }[]
}

type Race = { id: number; type: RaceType; status?: string; startsAt?: string; endsAt?: string; starts_at?: string; ends_at?: string; participants?: number; prizePool?: string; settledAt?: string | null }
type Reward = { id: number; raceId?: number; userId?: number | string; username?: string; rank?: number; points?: string; amount?: string; currency?: string; claimed?: boolean; createdAt?: string }
type Boat = { id: number; name: string; isActive?: boolean }

const NUMERIC_FIELDS: { key: keyof RaceConfig; label: string; hint?: string }[] = [
  { key: 'sportsPoints', label: 'Sports points / USD' },
  { key: 'casinoPoints', label: 'Casino points / USD' },
  { key: 'slotPoints', label: 'Slot points / USD' },
  { key: 'crashPoints', label: 'Crash points / USD' },
  { key: 'otherPoints', label: 'Other points / USD', hint: 'Roulette, table games and anything unclassified. Zero here means a third of turnover scores nothing.' },
  { key: 'prizePool', label: 'Prize pool', hint: 'Gross. The platform fee comes off before ranks are paid.' },
  { key: 'platformFeePercent', label: 'Platform fee %' },
  { key: 'winnerCount', label: 'Ranks paid' },
  { key: 'top3Percentage', label: 'Top-3 share %' },
  { key: 'minPoints', label: 'Minimum points to place' }
]

const ConfigEditor = ({ type }: { type: RaceType }) => {
  const q = useApi<RaceConfig>(`admin/user/race/config/${type}`, undefined, { retry: false })
  const [draft, setDraft] = useState<Partial<RaceConfig>>({})

  useEffect(() => setDraft({}), [type])

  const save = useApiMutation({
    fn: () => api.put(`admin/user/race/config/${type}`, draft),
    invalidate: [['api', `admin/user/race/config/${type}`]],
    success: `${type} race configuration saved`,
    onSuccess: () => setDraft({})
  })

  if (q.error) return <ErrorState error={q.error} />
  if (q.isLoading || !q.data) return <Skeleton className='h-96' />
  const c = { ...q.data, ...draft }
  const dirty = Object.keys(draft).length

  return (
    <div className='grid gap-4 lg:grid-cols-3'>
      <Card className='shadow-none lg:col-span-2'>
        <CardHeader>
          <CardTitle className='flex items-center gap-3 text-base'>
            {type[0].toUpperCase() + type.slice(1)} race
            <StatusBadge value={c.enabled ? 'enabled' : 'disabled'} />
          </CardTitle>
          <CardDescription>A race that pays real money starts switched off. Turn it on deliberately.</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-3'>
          <SwitchField id='r-enabled' label='Race is running' checked={!!c.enabled} onChange={enabled => setDraft(d => ({ ...d, enabled }))} />
          <div className='grid gap-3 sm:grid-cols-2'>
            {NUMERIC_FIELDS.map(f => (
              <TextField
                key={String(f.key)}
                id={`r-${String(f.key)}`}
                label={f.label}
                hint={f.hint}
                value={String(c[f.key] ?? '')}
                onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
              />
            ))}
          </div>
          <SwitchField
            id='r-seats'
            label='Booked seats'
            hint='Decorative entries shown on the board alongside real players.'
            checked={!!c.bookedSeatsEnabled}
            onChange={bookedSeatsEnabled => setDraft(d => ({ ...d, bookedSeatsEnabled }))}
          />
          <Can permission='config:write'>
            <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending} className='justify-self-start'>
              <SaveIcon /> Save {dirty ? `(${dirty})` : ''}
            </Button>
          </Can>
        </CardContent>
      </Card>
      <Card className='shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>Payout curve</CardTitle>
          <CardDescription>Derived when the configuration is saved — this is the table that pays.</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-1 text-sm'>
          {(q.data.rankPercentage ?? []).length ? (
            q.data.rankPercentage!.map(r => (
              <div key={r.rank} className='flex justify-between'>
                <span className='text-muted-foreground'>Rank {r.rank}</span>
                <span className='tabular-nums'>
                  {r.percentage}% {r.amount ? <Money value={r.amount} currency={q.data.currency} className='ml-2' /> : null}
                </span>
              </div>
            ))
          ) : (
            <p className='text-muted-foreground'>No curve computed yet. Save a pool and a rank count to generate one.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const RacesTab = () => {
  const { state, set, query } = useListState(['type'])
  const list = usePagedApi<Race>('admin/user/race/races', { limit: query.limit, page: query.page, type: query.type || undefined })
  const settle = useApiMutation({
    fn: (id: number) => api.post(`admin/user/race/races/${id}/settle`),
    invalidate: [['paged', 'admin/user/race/races'], ['paged', 'admin/user/race/rewards']],
    success: 'Race settled — rewards written'
  })

  const columns: Column<Race>[] = [
    { key: 'id', header: 'Race', cell: r => <span className='font-mono text-xs'>#{r.id}</span> },
    { key: 'type', header: 'Type', cell: r => <Badge variant='secondary'>{r.type}</Badge> },
    { key: 'window', header: 'Window', cell: r => <span className='text-xs'><DateTime value={r.startsAt ?? r.starts_at} /> → <DateTime value={r.endsAt ?? r.ends_at} /></span> },
    { key: 'pool', header: 'Pool', align: 'right', cell: r => <Money value={r.prizePool} /> },
    { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.settledAt ? 'settled' : (r.status ?? 'open')} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: r =>
        r.settledAt ? null : (
          <Can permission='config:write'>
            <ConfirmDialog
              trigger={
                <Button variant='outline' size='sm'>
                  <FlagIcon /> Settle
                </Button>
              }
              title={`Settle race #${r.id}?`}
              description='Ranks are frozen and rewards are written to the winners. This cannot be undone.'
              confirmLabel='Settle'
              onConfirm={() => settle.mutateAsync(r.id)}
            />
          </Can>
        )
    }
  ]

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={r => r.id}
      loading={list.isLoading}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      emptyMessage='No race has opened yet. The user-service worker opens them on schedule once a config is enabled.'
      toolbar={
        <Select value={String(state.type || 'all')} onValueChange={v => v && set({ type: v === 'all' ? '' : v })}>
          <SelectTrigger className='w-36'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Any type</SelectItem>
            <SelectItem value='daily'>Daily</SelectItem>
            <SelectItem value='weekly'>Weekly</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  )
}

const RewardsTab = () => {
  const { state, set, query } = useListState(['type', 'claimed'])
  const list = usePagedApi<Reward>('admin/user/race/rewards', {
    limit: query.limit,
    page: query.page,
    type: query.type || undefined,
    claimed: query.claimed || undefined
  })

  const columns: Column<Reward>[] = [
    { key: 'rank', header: 'Rank', cell: r => <span className='tabular-nums'>{r.rank ?? '—'}</span> },
    { key: 'user', header: 'Player', cell: r => <span>{r.username ?? `#${r.userId}`}</span> },
    { key: 'points', header: 'Points', align: 'right', cell: r => <span className='font-mono tabular-nums'>{r.points ?? '—'}</span> },
    { key: 'amount', header: 'Reward', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
    { key: 'claimed', header: 'Claimed', cell: r => <StatusBadge value={r.claimed ? 'completed' : 'pending'} /> },
    { key: 'at', header: 'When', cell: r => <DateTime value={r.createdAt} relative /> }
  ]

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={r => r.id}
      loading={list.isLoading}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
      toolbar={
        <>
          <Select value={String(state.type || 'all')} onValueChange={v => v && set({ type: v === 'all' ? '' : v })}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Any type</SelectItem>
              <SelectItem value='daily'>Daily</SelectItem>
              <SelectItem value='weekly'>Weekly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(state.claimed || 'all')} onValueChange={v => v && set({ claimed: v === 'all' ? '' : v })}>
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Claimed or not</SelectItem>
              <SelectItem value='true'>Claimed</SelectItem>
              <SelectItem value='false'>Unclaimed</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    />
  )
}

const BoatsTab = () => {
  const list = useApi<Boat[]>('admin/user/race/boats', undefined, { retry: false })
  const [name, setName] = useState('')
  const add = useApiMutation({
    fn: () => api.post('admin/user/race/boats', { name, isActive: true }),
    invalidate: [['api', 'admin/user/race/boats']],
    success: 'Entry added',
    onSuccess: () => setName('')
  })
  const toggle = useApiMutation({
    fn: (v: { id: number; isActive: boolean }) => api.put(`admin/user/race/boats/${v.id}`, { isActive: v.isActive }),
    invalidate: [['api', 'admin/user/race/boats']],
    success: 'Entry updated'
  })
  const remove = useApiMutation({
    fn: (id: number) => api.delete(`admin/user/race/boats/${id}`),
    invalidate: [['api', 'admin/user/race/boats']],
    success: 'Entry removed'
  })

  const columns: Column<Boat>[] = [
    { key: 'name', header: 'Name', cell: b => b.name },
    { key: 'active', header: 'Shown', cell: b => <Can permission='config:write' fallback={<StatusBadge value={b.isActive} />}><Button variant='ghost' size='sm' onClick={() => toggle.mutate({ id: b.id, isActive: !b.isActive })}><StatusBadge value={b.isActive ? 'active' : 'inactive'} /></Button></Can> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: b => (
        <Can permission='config:write'>
          <ConfirmDialog
            trigger={
              <Button variant='ghost' size='icon-sm' aria-label='Remove'>
                <Trash2Icon />
              </Button>
            }
            title={`Remove “${b.name}”?`}
            confirmLabel='Remove'
            destructive
            onConfirm={() => remove.mutateAsync(b.id)}
          />
        </Can>
      )
    }
  ]

  return (
    <div className='grid gap-4'>
      <p className='text-muted-foreground text-sm'>
        Decorative entries shown on the leaderboard beside real players, when booked seats are switched on for a race type.
      </p>
      <Can permission='config:write'>
        <FormDialog
          trigger={
            <Button className='justify-self-start'>
              <PlusIcon /> Add entry
            </Button>
          }
          title='Add a booked seat'
          submitLabel='Add'
          onSubmit={() => add.mutateAsync()}
        >
          <TextField id='boat-name' label='Display name' required maxLength={60} value={name} onChange={e => setName(e.target.value)} />
        </FormDialog>
      </Can>
      <DataTable columns={columns} rows={list.data} rowKey={b => b.id} loading={list.isLoading} error={list.error} dense emptyMessage='No booked seats configured.' />
    </div>
  )
}

const Races = () => {
  const [type, setType] = useState<RaceType>('daily')

  return (
    <div>
      <PageHeader
        title='Wagering races'
        description='Turnover contests with a prize pool. Points per product are configurable; a race is one window of a config and pays when it is settled.'
      />
      <Tabs defaultValue='config'>
        <TabsList className='mb-4'>
          <TabsTrigger value='config'>Configuration</TabsTrigger>
          <TabsTrigger value='races'>Races</TabsTrigger>
          <TabsTrigger value='rewards'>Rewards</TabsTrigger>
          <TabsTrigger value='boats'>Booked seats</TabsTrigger>
        </TabsList>
        <TabsContent value='config'>
          <Tabs value={type} onValueChange={v => setType(v as RaceType)} className='mb-4'>
            <TabsList>
              <TabsTrigger value='daily'>Daily</TabsTrigger>
              <TabsTrigger value='weekly'>Weekly</TabsTrigger>
            </TabsList>
          </Tabs>
          <ConfigEditor type={type} />
        </TabsContent>
        <TabsContent value='races'>
          <RacesTab />
        </TabsContent>
        <TabsContent value='rewards'>
          <RewardsTab />
        </TabsContent>
        <TabsContent value='boats'>
          <BoatsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Races
