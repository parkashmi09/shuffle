'use client'

import { useState } from 'react'

import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useListState, usePagedApi } from '@/hooks/use-api'
import type { MarketResult } from './types'

const value = (r: MarketResult, ...names: string[]) => {
  for (const n of names) {
    const v = r[n]

    if (v !== undefined && v !== null && v !== '') return String(v)
  }

  return ''
}

const columns: Column<MarketResult>[] = [
  {
    key: 'match',
    header: 'Match',
    cell: r => (
      <span className='block max-w-96'>
        <span className='block truncate text-sm'>{value(r, 'matchTitle', 'match_title') || value(r, 'matchId', 'match_id') || '—'}</span>
        <span className='text-muted-foreground block truncate font-mono text-xs'>{value(r, 'matchId', 'match_id')}</span>
      </span>
    )
  },
  { key: 'market', header: 'Market', cell: r => value(r, 'marketType', 'market_type') || '—' },
  { key: 'winner', header: 'Result', cell: r => <span className='text-sm'>{value(r, 'winnerName', 'winner_name') || '—'}</span> },
  { key: 'user', header: 'Player', cell: r => value(r, 'username') || (r.userId ? `#${r.userId}` : '—') },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} signed /> },
  { key: 'at', header: 'When', cell: r => <DateTime value={value(r, 'createdAt', 'created_at') || undefined} relative /> }
]

const MarketResults = () => {
  const { state, set, query } = useListState(['userId', 'matchId'])
  const list = usePagedApi<MarketResult>('admin/sports/results/markets', {
    limit: query.limit,
    page: query.page,
    search: query.search,
    userId: query.userId || undefined,
    matchId: query.matchId || undefined
  })

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={(r, i) => String(r.id ?? i)}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      search={String(state.search ?? '')}
      onSearchChange={search => set({ search })}
      searchPlaceholder='Match, market or player…'
      dense
      toolbar={
        <>
          <Input placeholder='Player id' className='w-28' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} />
          <Input placeholder='Match id' className='w-36' value={String(state.matchId ?? '')} onChange={e => set({ matchId: e.target.value })} />
        </>
      }
    />
  )
}

const FancyResults = () => {
  const { set, query } = useListState()
  const list = usePagedApi<MarketResult>('admin/sports/results/fancy', { limit: query.limit, page: query.page })

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={(r, i) => String(r.id ?? i)}
      loading={list.isLoading}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
    />
  )
}

const PerPlayer = () => {
  const [userId, setUserId] = useState('')
  const { set, query } = useListState()
  const list = usePagedApi<MarketResult>(/^\d+$/.test(userId) ? `admin/sports/results/markets/user/${userId}` : null, { limit: query.limit, page: query.page })

  return (
    <div className='grid gap-4'>
      <Input placeholder='Player id' className='w-48' value={userId} onChange={e => setUserId(e.target.value.replace(/\D/g, ''))} />
      {/^\d+$/.test(userId) && (
        <DataTable
          columns={columns}
          rows={list.data?.rows}
          rowKey={(r, i) => String(r.id ?? i)}
          loading={list.isLoading}
          error={list.error}
          pagination={list.data?.pagination}
          onPageChange={page => set({ page })}
          onLimitChange={limit => set({ limit })}
          dense
        />
      )}
    </div>
  )
}

const Results = () => (
  <div>
    <PageHeader title='Sports results' description='What each settled market paid, per player. This is the record the settlement screen writes.' />
    <Tabs defaultValue='markets'>
      <TabsList className='mb-4'>
        <TabsTrigger value='markets'>Markets</TabsTrigger>
        <TabsTrigger value='fancy'>Fancy</TabsTrigger>
        <TabsTrigger value='player'>By player</TabsTrigger>
      </TabsList>
      <TabsContent value='markets'>
        <MarketResults />
      </TabsContent>
      <TabsContent value='fancy'>
        <FancyResults />
      </TabsContent>
      <TabsContent value='player'>
        <PerPlayer />
      </TabsContent>
    </Tabs>
  </div>
)

export default Results
