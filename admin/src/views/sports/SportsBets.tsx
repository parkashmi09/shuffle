'use client'

import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useListState, usePagedApi } from '@/hooks/use-api'
import { BET_STATUSES, GAME_TYPES, GAME_TYPE_LABELS, type Exposure, type SportsBet } from './types'

const betColumns: Column<SportsBet>[] = [
  { key: 'id', header: 'Bet', cell: b => <span className='font-mono text-xs'>#{b.id}</span> },
  { key: 'user', header: 'Player', cell: b => <span>{b.username ?? `#${b.userId ?? '—'}`}</span> },
  {
    key: 'match',
    header: 'Market',
    cell: b => (
      <span className='block max-w-80'>
        <span className='block truncate text-sm'>{b.matchTitle ?? b.matchId ?? '—'}</span>
        <span className='text-muted-foreground block truncate text-xs'>
          {b.marketType ?? ''} {b.selectionName ? `· ${b.selectionName}` : ''}
        </span>
      </span>
    )
  },
  { key: 'type', header: 'Type', cell: b => <Badge variant='outline'>{GAME_TYPE_LABELS[String(b.gameType)] ?? b.gameType ?? '—'}</Badge> },
  { key: 'side', header: 'Side', cell: b => <span className='text-xs uppercase'>{String(b.side ?? '—')}</span> },
  { key: 'odds', header: 'Odds', align: 'right', cell: b => <span className='font-mono tabular-nums'>{String(b.odds ?? '—')}</span> },
  { key: 'stake', header: 'Stake', align: 'right', cell: b => <Money value={b.stake} /> },
  { key: 'liability', header: 'Liability', align: 'right', cell: b => <Money value={b.liability} /> },
  { key: 'status', header: 'Status', cell: b => <StatusBadge value={b.resultStatus ?? b.status} /> },
  { key: 'at', header: 'Placed', cell: b => <DateTime value={b.placedAt ?? b.createdAt} relative /> }
]

const AllBets = () => {
  const { state, set, query } = useListState(['status', 'gameType', 'userId', 'matchId'])
  const list = usePagedApi<SportsBet>('admin/sports/bet-admin/bets', {
    limit: query.limit,
    page: query.page,
    status: query.status || undefined,
    gameType: query.gameType || undefined,
    userId: query.userId || undefined,
    matchId: query.matchId || undefined
  })

  return (
    <DataTable
      columns={betColumns}
      rows={list.data?.rows}
      rowKey={b => b.id}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
      emptyMessage='No sports bet matches these filters.'
      toolbar={
        <>
          <Select value={String(state.status || 'all')} onValueChange={v => v && set({ status: v === 'all' ? '' : v })}>
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Any status</SelectItem>
              {BET_STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(state.gameType || 'all')} onValueChange={v => v && set({ gameType: v === 'all' ? '' : v })}>
            <SelectTrigger className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Any market type</SelectItem>
              {GAME_TYPES.map(g => (
                <SelectItem key={g} value={g}>
                  {GAME_TYPE_LABELS[g]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder='Player id' className='w-28' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} />
          <Input placeholder='Match id' className='w-36' value={String(state.matchId ?? '')} onChange={e => set({ matchId: e.target.value })} />
        </>
      }
    />
  )
}

const ExposureTab = () => {
  const { set, query } = useListState()
  const list = usePagedApi<Exposure>('admin/sports/bet-admin/exposure', { limit: query.limit, page: query.page })

  const columns: Column<Exposure>[] = [
    { key: 'user', header: 'Player', cell: e => <span>{e.username ?? `#${e.userId ?? '—'}`}</span> },
    { key: 'open', header: 'Open bets', align: 'right', cell: e => <span className='tabular-nums'>{String(e.openBets ?? '—')}</span> },
    { key: 'exposure', header: 'Exposure', align: 'right', cell: e => <Money value={e.exposure ?? e.liability} /> }
  ]

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={(e, i) => String(e.userId ?? i)}
      loading={list.isLoading}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
      emptyMessage='Nobody is carrying open sports liability.'
    />
  )
}

const Ticker = () => {
  const list = usePagedApi<SportsBet>('admin/sports/bet-admin/bets/ticker', { limit: 50 }, { refetchInterval: 10_000 })

  return (
    <Card className='shadow-none'>
      <CardHeader>
        <CardTitle className='text-base'>Live ticker</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable columns={betColumns} rows={list.data?.rows} rowKey={b => b.id} loading={list.isLoading} error={list.error} dense emptyMessage='No bet placed recently.' />
      </CardContent>
    </Card>
  )
}

const SportsBets = () => (
  <div>
    <PageHeader title='Sports bets' description='Every bet the sportsbook has taken, what the house is carrying on each player, and a live feed of what is being placed now.' />
    <Tabs defaultValue='bets'>
      <TabsList className='mb-4'>
        <TabsTrigger value='bets'>All bets</TabsTrigger>
        <TabsTrigger value='exposure'>Net exposure</TabsTrigger>
        <TabsTrigger value='ticker'>Live ticker</TabsTrigger>
      </TabsList>
      <TabsContent value='bets'>
        <AllBets />
      </TabsContent>
      <TabsContent value='exposure'>
        <ExposureTab />
      </TabsContent>
      <TabsContent value='ticker'>
        <Ticker />
      </TabsContent>
    </Tabs>
  </div>
)

export default SportsBets
