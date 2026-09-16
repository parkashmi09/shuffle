'use client'

import { useState } from 'react'

import { AlertTriangleIcon, GavelIcon, UndoIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import FormDialog from '@/components/shared/FormDialog'
import { TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { GAME_TYPE_LABELS, type SettledMarket, type SettlementMatch, type SportsBet } from './types'

/**
 * Settlement moves money, so every screen here is deliberate: declaring a
 * result pays a market out, voiding returns stakes, and reversing an
 * ALREADY-PAID settlement is a separate grant (`sports:void-settled`) because
 * it is a strictly larger power than settling one.
 */
const field = (row: SettlementMatch, ...names: string[]) => {
  for (const n of names) {
    const v = row[n]

    if (v !== undefined && v !== null && v !== '') return String(v)
  }

  return ''
}

const DeclareResult = ({ row }: { row: SettlementMatch }) => {
  const [form, setForm] = useState({
    eventid: field(row, 'eventid', 'eventId'),
    match_id: field(row, 'match_id', 'matchId'),
    match_title: field(row, 'match_title', 'matchTitle'),
    game_type: field(row, 'game_type', 'gameType') || 'MO',
    market_type: field(row, 'market_type', 'marketType'),
    winnerName: '',
    winnerId: '',
    fancyName: ''
  })
  const declare = useApiMutation({
    fn: () => {
      const body: Record<string, string> = {
        eventid: form.eventid,
        match_id: form.match_id,
        match_title: form.match_title,
        game_type: form.game_type,
        market_type: form.market_type
      }

      if (form.winnerName) body.winnerName = form.winnerName
      if (form.winnerId) body.winnerId = form.winnerId
      if (form.fancyName) body.fancyName = form.fancyName

      return api.post('admin/sports/settlement/declare-result', body)
    },
    invalidate: [['paged', 'admin/sports/settlement/mo-matches'], ['paged', 'admin/sports/settlement/fancy-matches'], ['paged', 'admin/sports/settlement/settled-markets']],
    success: 'Market settled — winners paid'
  })

  return (
    <FormDialog
      trigger={
        <Button size='sm'>
          <GavelIcon /> Declare
        </Button>
      }
      title='Declare the result'
      description='Every open bet on this market is settled and the winners are paid immediately. Check the winner before confirming.'
      submitLabel='Settle market'
      onSubmit={() => declare.mutateAsync()}
      wide
    >
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='d-match' label='Match id' required value={form.match_id} onChange={e => setForm({ ...form, match_id: e.target.value })} />
        <TextField id='d-event' label='Event id' required value={form.eventid} onChange={e => setForm({ ...form, eventid: e.target.value })} />
      </div>
      <TextField id='d-title' label='Match title' required value={form.match_title} onChange={e => setForm({ ...form, match_title: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='d-game' label='Game type' required hint='MO, BM or FAN' value={form.game_type} onChange={e => setForm({ ...form, game_type: e.target.value })} />
        <TextField id='d-market' label='Market type' required value={form.market_type} onChange={e => setForm({ ...form, market_type: e.target.value })} />
      </div>
      <TextField id='d-winner' label='Winner name' hint='The selection that won. For a fancy market give the fancy name and the winning number instead.' value={form.winnerName} onChange={e => setForm({ ...form, winnerName: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='d-wid' label='Winner id' value={form.winnerId} onChange={e => setForm({ ...form, winnerId: e.target.value })} />
        <TextField id='d-fancy' label='Fancy name' value={form.fancyName} onChange={e => setForm({ ...form, fancyName: e.target.value })} />
      </div>
    </FormDialog>
  )
}

const VoidMarket = ({ row }: { row: SettlementMatch }) => {
  const [form, setForm] = useState({
    eventid: field(row, 'eventid', 'eventId'),
    match_id: field(row, 'match_id', 'matchId'),
    market_type: field(row, 'market_type', 'marketType'),
    gametype: field(row, 'game_type', 'gameType') || 'MO',
    selection_name: ''
  })
  const voidIt = useApiMutation({
    fn: () => api.post('admin/sports/settlement/void-market', { ...(form.eventid ? { eventid: form.eventid } : {}), match_id: form.match_id, market_type: form.market_type, gametype: form.gametype, selection_name: form.selection_name }),
    invalidate: [['paged', 'admin/sports/settlement/mo-matches'], ['paged', 'admin/sports/settlement/fancy-matches']],
    success: 'Market voided — stakes returned'
  })

  return (
    <FormDialog
      trigger={
        <Button size='sm' variant='outline'>
          <UndoIcon /> Void
        </Button>
      }
      title='Void this market'
      description='Every open bet on the named selection is cancelled and its stake returned.'
      submitLabel='Void market'
      destructive
      onSubmit={() => voidIt.mutateAsync()}
    >
      <TextField id='v-match' label='Match id' required value={form.match_id} onChange={e => setForm({ ...form, match_id: e.target.value })} />
      <TextField id='v-market' label='Market type' required value={form.market_type} onChange={e => setForm({ ...form, market_type: e.target.value })} />
      <TextField id='v-game' label='Game type' required value={form.gametype} onChange={e => setForm({ ...form, gametype: e.target.value })} />
      <TextField id='v-sel' label='Selection name' required hint='The selection to void. Required — voiding is per selection, not per match.' value={form.selection_name} onChange={e => setForm({ ...form, selection_name: e.target.value })} />
    </FormDialog>
  )
}

const pendingColumns = (): Column<SettlementMatch>[] => [
  {
    key: 'match',
    header: 'Match',
    cell: r => (
      <span className='block max-w-96'>
        <span className='block truncate font-medium'>{field(r, 'match_title', 'matchTitle') || field(r, 'match_id', 'matchId')}</span>
        <span className='text-muted-foreground block truncate font-mono text-xs'>{field(r, 'match_id', 'matchId')}</span>
      </span>
    )
  },
  { key: 'market', header: 'Market', cell: r => <span className='text-sm'>{field(r, 'market_type', 'marketType') || '—'}</span> },
  { key: 'type', header: 'Type', cell: r => <Badge variant='outline'>{GAME_TYPE_LABELS[field(r, 'game_type', 'gameType')] ?? field(r, 'game_type', 'gameType') ?? '—'}</Badge> },
  { key: 'open', header: 'Open bets', align: 'right', cell: r => <span className='tabular-nums'>{String(r.openBets ?? r.bets ?? '—')}</span> },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (
      <Can permission='sports:settle'>
        <span className='flex justify-end gap-1'>
          <DeclareResult row={r} />
          <VoidMarket row={r} />
        </span>
      </Can>
    )
  }
]

const Pending = ({ kind }: { kind: 'mo-matches' | 'fancy-matches' }) => {
  const { set, query } = useListState()
  const list = usePagedApi<SettlementMatch>(`admin/sports/settlement/${kind}`, { limit: query.limit, page: query.page })

  return (
    <DataTable
      columns={pendingColumns()}
      rows={list.data?.rows}
      rowKey={(r, i) => `${field(r, 'match_id', 'matchId')}-${field(r, 'market_type', 'marketType')}-${i}`}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      emptyMessage='Nothing waiting to be settled.'
    />
  )
}

const Settled = () => {
  const { state, set, query } = useListState()
  const list = usePagedApi<SettledMarket>('admin/sports/settlement/settled-markets', { limit: query.limit, page: query.page, search: query.search })
  const reverse = useApiMutation({
    fn: (v: { match_id: string; market_type: string }) => api.post('admin/sports/settlement/void-market/post-settlement', v),
    invalidate: [['paged', 'admin/sports/settlement/settled-markets']],
    success: 'Settlement reversed — payouts clawed back'
  })

  const columns: Column<SettledMarket>[] = [
    {
      key: 'match',
      header: 'Match',
      cell: r => (
        <span className='block max-w-96'>
          <span className='block truncate font-medium'>{field(r, 'match_title', 'matchTitle') || field(r, 'match_id', 'matchId')}</span>
          <span className='text-muted-foreground block truncate font-mono text-xs'>{field(r, 'match_id', 'matchId')}</span>
        </span>
      )
    },
    { key: 'market', header: 'Market', cell: r => field(r, 'market_type', 'marketType') || '—' },
    { key: 'winner', header: 'Winner', cell: r => <span className='text-sm'>{field(r, 'winnerName', 'winner_name') || '—'}</span> },
    { key: 'at', header: 'Settled', cell: r => <DateTime value={field(r, 'settledAt', 'settled_at') || undefined} relative /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: r => (
        <Can permission='sports:void-settled'>
          <ConfirmDialog
            trigger={
              <Button size='sm' variant='destructive'>
                <UndoIcon /> Reverse
              </Button>
            }
            title='Reverse this settlement?'
            description='Winners already have this money. Reversing takes it back and can put an account into negative balance. This is the largest power on the sportsbook.'
            confirmLabel='Reverse settlement'
            destructive
            onConfirm={() => reverse.mutateAsync({ match_id: field(r, 'match_id', 'matchId'), market_type: field(r, 'market_type', 'marketType') })}
          />
        </Can>
      )
    }
  ]

  return (
    <div className='grid gap-4'>
      <Alert>
        <AlertTriangleIcon />
        <AlertTitle>Reversing a settlement is not the same as voiding a market</AlertTitle>
        <AlertDescription>
          Voiding cancels open bets. Reversing claws back money already paid, and it needs the separate <code>sports:void-settled</code> grant.
        </AlertDescription>
      </Alert>
      <DataTable
        columns={columns}
        rows={list.data?.rows}
        rowKey={(r, i) => `${field(r, 'match_id', 'matchId')}-${i}`}
        loading={list.isLoading}
        error={list.error}
        pagination={list.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        search={String(state.search ?? '')}
        onSearchChange={search => set({ search })}
        searchPlaceholder='Match or market…'
      />
    </div>
  )
}

const OpenBets = () => {
  const [q, setQ] = useState({ match_id: '', market_type: '' })
  const ready = q.match_id.trim() && q.market_type.trim()
  const list = usePagedApi<SportsBet>(ready ? 'admin/sports/settlement/open-bets' : null, { match_id: q.match_id, market_type: q.market_type })
  const voidBet = useApiMutation({
    fn: (bet_id: number) => api.post('admin/sports/settlement/void-bet', { bet_id }),
    invalidate: [['paged', 'admin/sports/settlement/open-bets']],
    success: 'Bet voided — stake returned'
  })

  const columns: Column<SportsBet>[] = [
    { key: 'id', header: 'Bet', cell: b => <span className='font-mono text-xs'>#{b.id}</span> },
    { key: 'user', header: 'Player', cell: b => b.username ?? `#${b.userId ?? '—'}` },
    { key: 'sel', header: 'Selection', cell: b => String(b.selectionName ?? '—') },
    { key: 'odds', header: 'Odds', align: 'right', cell: b => <span className='font-mono tabular-nums'>{String(b.odds ?? '—')}</span> },
    { key: 'stake', header: 'Stake', align: 'right', cell: b => <Money value={b.stake} /> },
    { key: 'status', header: 'Status', cell: b => <StatusBadge value={b.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: b => (
        <Can permission='sports:settle'>
          <ConfirmDialog
            trigger={
              <Button size='sm' variant='outline'>
                Void
              </Button>
            }
            title={`Void bet #${b.id}?`}
            description='The stake is returned to the player and the bet is removed from the market’s liability.'
            confirmLabel='Void bet'
            destructive
            onConfirm={() => voidBet.mutateAsync(b.id)}
          />
        </Can>
      )
    }
  ]

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-end gap-2'>
        <TextField id='ob-match' label='Match id' value={q.match_id} onChange={e => setQ({ ...q, match_id: e.target.value })} />
        <TextField id='ob-market' label='Market type' value={q.market_type} onChange={e => setQ({ ...q, market_type: e.target.value })} />
      </div>
      {ready ? (
        <DataTable columns={columns} rows={list.data?.rows} rowKey={b => b.id} loading={list.isLoading} error={list.error} dense emptyMessage='No open bet on that market.' />
      ) : (
        <p className='text-muted-foreground text-sm'>Name a match and a market to list the bets still open on it.</p>
      )}
    </div>
  )
}

const Settlement = () => (
  <div>
    <PageHeader title='Sports settlement' description='Markets waiting for a result, the bets open on them, and what has already been settled.' />
    <Tabs defaultValue='mo'>
      <TabsList className='mb-4 flex-wrap'>
        <TabsTrigger value='mo'>Match odds &amp; bookmaker</TabsTrigger>
        <TabsTrigger value='fancy'>Fancy</TabsTrigger>
        <TabsTrigger value='open'>Open bets</TabsTrigger>
        <TabsTrigger value='settled'>Settled</TabsTrigger>
      </TabsList>
      <TabsContent value='mo'>
        <Pending kind='mo-matches' />
      </TabsContent>
      <TabsContent value='fancy'>
        <Pending kind='fancy-matches' />
      </TabsContent>
      <TabsContent value='open'>
        <OpenBets />
      </TabsContent>
      <TabsContent value='settled'>
        <Settled />
      </TabsContent>
    </Tabs>
  </div>
)

export default Settlement
