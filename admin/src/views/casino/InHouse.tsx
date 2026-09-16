'use client'

import { useState } from 'react'

import { ClockIcon, Loader2Icon, PlayIcon, RotateCcwIcon, SaveIcon, SquareIcon, TrophyIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import type { HouseBet, HouseClock, HouseRow } from './types'
import { usePageList } from './usePageList'

/** Legacy `config.js` house edge, applied by every in-house game. Not editable through the API. */
const HOUSE_EDGE_PERCENT = 2
const GAMES = ['crash', 'classic_dice', 'hash_dice', 'limbo', 'keno', 'single_keno', 'hilo', 'highlow', 'wheel', 'magic_wheel', 'plinko', 'mine', 'tower', 'diamond', 'goal', 'roulette', 'blackjack', 'videopoker', 'three_card_monte', 'snake_and_ladders']

const HOUSE_LIST = 'admin/casino/house'
const invalidateHouse = [['paged', HOUSE_LIST], ['api', 'admin/casino/house/ticker']]

const CounterRow = ({ row, auto }: { row: HouseRow; auto: boolean }) => {
  const [max, setMax] = useState(row.max)
  const [current, setCurrent] = useState(row.current)
  const { can } = useSession()
  const canWrite = can('config:write') && !auto
  const update = useApiMutation({
    fn: (body: { max: number; current: number }) => api.post(HOUSE_LIST, { userId: Number(row.userId), ...body }),
    invalidate: invalidateHouse,
    success: `Counter for #${row.userId} saved`
  })
  const blocked = Number(row.max) === 0
  const dirty = max !== row.max || current !== row.current

  return (
    <>
      <td className='px-4 py-2'>
        <div className='font-medium'>{row.name ?? '—'}</div>
        <div className='text-muted-foreground font-mono text-xs'>#{row.userId}</div>
      </td>
      <td className='px-2 py-2'>
        <Input className='w-24' value={max} disabled={!canWrite} onChange={e => setMax(e.target.value)} />
      </td>
      <td className='px-2 py-2'>
        <Input className='w-24' value={current} disabled={!canWrite} onChange={e => setCurrent(e.target.value)} />
      </td>
      <td className='px-2 py-2 text-center'>
        <StatusBadge value={blocked ? 'blocked' : 'allowed'} />
      </td>
      <td className='px-4 py-2'>
        <div className='flex justify-end gap-1'>
          <Button size='sm' variant='outline' disabled={!canWrite || !dirty || update.isPending} onClick={() => update.mutate({ max: Number(max), current: Number(current) })}>
            <SaveIcon /> Save
          </Button>
          <Button size='sm' variant='ghost' disabled={!canWrite || update.isPending} onClick={() => update.mutate(blocked ? { max: 50, current: 0 } : { max: 0, current: 0 })}>
            {blocked ? 'Allow' : 'Block'}
          </Button>
        </div>
      </td>
    </>
  )
}

const CountersTab = () => {
  const { can } = useSession()
  const [auto, setAuto] = useState(false)
  const { state, set } = useListState()
  const list = usePagedApi<HouseRow>(HOUSE_LIST, { limit: state.limit, page: state.page }, { refetchInterval: auto ? 3000 : false })
  const ticker = useApi<{ running: boolean }>('admin/casino/house/ticker', undefined, { refetchInterval: 10_000 })
  const clock = useApi<HouseClock>('admin/casino/house/clock', undefined, { refetchInterval: 60_000 })

  const bulk = useApiMutation({ fn: (preset: 'reset' | 'win') => api.post('admin/casino/house/bulk', { preset, scope: 'all' }), invalidate: invalidateHouse, success: (_r, preset) => (preset === 'reset' ? 'Every counter reset' : 'Every counter set to win') })
  const setTicker = useApiMutation({ fn: (running: boolean) => api.post('admin/casino/house/ticker', { running }), invalidate: [['api', 'admin/casino/house/ticker']], success: (_r, running) => (running ? 'Ticker started' : 'Ticker stopped') })

  const rows = list.data?.rows
  const p = list.data?.pagination

  return (
    <div className='grid gap-4'>
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard label='Ticker' value={<StatusBadge value={ticker.data ? (ticker.data.running ? 'active' : 'inactive') : undefined} />} loading={ticker.isLoading} hint='Advances counters automatically when running' />
        <StatCard label='Server clock' value={clock.data ? `${String(clock.data.serverHour).padStart(2, '0')}:00` : '—'} loading={clock.isLoading} hint={clock.data ? `UTC ${clock.data.hour}:00 · offset ${clock.data.serverOffsetMinutes} min` : undefined} icon={<ClockIcon />} />
        <StatCard label='House edge' value={`${HOUSE_EDGE_PERCENT}%`} hint='Fixed in the engine; not editable via API' />
        <StatCard label='Players tracked' value={p ? p.total : '—'} loading={list.isLoading} hint={`${GAMES.length} in-house games`} />
      </div>
      <Card className='gap-0 overflow-hidden py-0 shadow-none'>
        <div className='flex flex-wrap items-center gap-3 border-b p-4'>
          <label className='flex items-center gap-2 text-sm'>
            <Switch checked={auto} onCheckedChange={setAuto} /> Automatic (poll every 3 s, editing off)
          </label>
          <div className='ml-auto flex flex-wrap gap-2'>
            <Can permission='config:write'>
              <ConfirmDialog trigger={<Button variant='outline'>{ticker.data?.running ? <SquareIcon /> : <PlayIcon />} {ticker.data?.running ? 'Stop ticker' : 'Start ticker'}</Button>} title={ticker.data?.running ? 'Stop the house ticker?' : 'Start the house ticker?'} onConfirm={() => setTicker.mutateAsync(!ticker.data?.running)} />
              <ConfirmDialog trigger={<Button variant='outline'><RotateCcwIcon /> Reset house</Button>} title='Reset every counter?' description='Applies to EVERY player: current goes back to 0.' destructive confirmLabel='Reset all' onConfirm={() => bulk.mutateAsync('reset')} />
              <ConfirmDialog trigger={<Button variant='outline'><TrophyIcon /> Win house</Button>} title='Set every counter to the win preset?' description='Applies to EVERY player. The house stops paying once current reaches max.' destructive confirmLabel='Apply to all' onConfirm={() => bulk.mutateAsync('win')} />
            </Can>
          </div>
        </div>
        {list.error ? (
          <div className='p-4'>
            <ErrorState error={list.error} />
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='text-muted-foreground border-b text-left'>
                <tr>
                  <th className='px-4 py-2 font-medium'>Player</th>
                  <th className='px-2 py-2 font-medium'>Max</th>
                  <th className='px-2 py-2 font-medium'>Current</th>
                  <th className='px-2 py-2 text-center font-medium'>Win/loss</th>
                  <th className='px-4 py-2'></th>
                </tr>
              </thead>
              <tbody>
                {list.isLoading && !rows ? (
                  <tr>
                    <td colSpan={5} className='text-muted-foreground p-6 text-center'>
                      <Loader2Icon className='mx-auto size-4 animate-spin' />
                    </td>
                  </tr>
                ) : rows && rows.length ? (
                  rows.map(r => (
                    <tr key={String(r.id)} className='border-b last:border-0'>
                      <CounterRow row={r} auto={auto} />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className='text-muted-foreground h-24 text-center'>
                      No house counters yet. A row appears once a player plays an in-house game.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {p && (
          <div className='flex items-center justify-between border-t px-4 py-3 text-sm'>
            <span className='text-muted-foreground'>{p.total === 0 ? 'No entries' : `Showing ${(p.page - 1) * p.limit + 1}–${Math.min(p.page * p.limit, p.total)} of ${p.total}`}</span>
            <div className='flex gap-2'>
              <Button size='sm' variant='outline' disabled={p.page <= 1} onClick={() => set({ page: p.page - 1 })}>
                Previous
              </Button>
              <Button size='sm' variant='outline' disabled={!p.hasNext} onClick={() => set({ page: p.page + 1 })}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      {!can('config:write') && <p className='text-muted-foreground text-sm'>Your role can read counters but not change them (needs config:write).</p>}
    </div>
  )
}

const betColumns: Column<HouseBet>[] = [
  { key: 'at', header: 'When', cell: r => <DateTime value={r.at} /> },
  {
    key: 'user',
    header: 'Player',
    cell: r => (
      <div>
        <div>{r.user ?? '—'}</div>
        <div className='text-muted-foreground font-mono text-xs'>#{r.userId}</div>
      </div>
    )
  },
  { key: 'game', header: 'Game', cell: r => <Badge variant='outline'>{r.game ?? '—'}</Badge> },
  { key: 'amount', header: 'Bet', align: 'right', cell: r => <Money value={r.amount} /> },
  { key: 'profit', header: 'Profit', align: 'right', cell: r => <Money value={r.profit} signed /> },
  { key: 'id', header: 'Bet id', cell: r => <span className='font-mono text-xs'>{r.id}</span> }
]

const BetsTab = ({ table }: { table: 'bets' | 'bets_2m' }) => {
  const { state, set } = useListState(['userId', 'from', 'to'])
  const list = usePageList<HouseBet>(`admin/casino/bet-history/house/${table}`, { limit: state.limit, page: state.page, userId: state.userId || undefined, from: state.from || undefined, to: state.to || undefined })

  return (
    <DataTable
      columns={betColumns}
      rows={list.data?.rows}
      rowKey={r => r.id}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
      toolbar={
        <>
          <Input placeholder='User id' className='w-32' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value })} />
          <Input type='date' className='w-40' value={String(state.from ?? '')} onChange={e => set({ from: e.target.value })} />
          <Input type='date' className='w-40' value={String(state.to ?? '')} onChange={e => set({ to: e.target.value })} />
        </>
      }
    />
  )
}

const InHouse = () => (
  <div>
    <PageHeader title='In-house games' description='The originals engine: per-player house counters (the win/loss switch), the ticker, and the bet ledger. Game rules, edge and seeds are fixed in the engine.' />
    <Tabs defaultValue='counters'>
      <TabsList className='mb-4 flex-wrap'>
        <TabsTrigger value='counters'>House counters</TabsTrigger>
        <TabsTrigger value='bets'>Bets</TabsTrigger>
        <TabsTrigger value='bets2m'>Bets (2m rounds)</TabsTrigger>
        <TabsTrigger value='engine'>Engine</TabsTrigger>
      </TabsList>
      <TabsContent value='counters'>
        <CountersTab />
      </TabsContent>
      <TabsContent value='bets'>
        <BetsTab table='bets' />
      </TabsContent>
      <TabsContent value='bets2m'>
        <BetsTab table='bets_2m' />
      </TabsContent>
      <TabsContent value='engine'>
        <Card className='max-w-2xl shadow-none'>
          <CardHeader>
            <CardTitle className='text-base'>Engine settings (read-only)</CardTitle>
            <CardDescription>These come from the casino service's in-house constants. There is no admin route to change them; a change is a deploy.</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 text-sm'>
            <div className='flex justify-between border-b pb-2'><span>House edge</span><span className='font-mono'>{HOUSE_EDGE_PERCENT}%</span></div>
            <div className='flex justify-between border-b pb-2'><span>Outcome source</span><span className='font-mono'>engine/hash.js SEED_SOURCE</span></div>
            <div className='flex justify-between border-b pb-2'><span>Win switch</span><span className='font-mono'>GameEngine.canProfit (current ≥ max blocks wins)</span></div>
            <div className='flex justify-between border-b pb-2'><span>Round timing</span><span className='font-mono'>wait 5 s · busted 5 s · max 5 min · keno 15 s / 3 s</span></div>
            <div>
              <div className='mb-1'>Games</div>
              <div className='flex flex-wrap gap-1'>
                {GAMES.map(g => (
                  <Badge key={g} variant='outline'>
                    {g}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
)

export default InHouse
