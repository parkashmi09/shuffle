'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'

import { DownloadIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'

import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import JsonView from '@/components/shared/JsonView'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi, useListState, usePagedApi } from '@/hooks/use-api'
import { api, errorMessage } from '@/lib/api/client'
import { formatMoney, formatNumber } from '@/lib/format'
import { ACCOUNT_TYPES, STATEMENT_CATEGORIES, daysAgo, downloadBlob, type Statement, type StatementRow, type TransferRow } from './types'

const party = (p: TransferRow['from']) => (
  <Link href={p.type === 'staff' ? `/staff/${p.id}` : `/players/${p.id}`} className='hover:underline'>
    {p.name ?? `${p.type} #${p.id}`}
    <span className='text-muted-foreground text-xs'> ({p.type})</span>
  </Link>
)

const transferColumns: Column<TransferRow>[] = [
  { key: 'at', header: 'When', cell: r => <DateTime value={r.createdAt} /> },
  { key: 'from', header: 'From', cell: r => party(r.from) },
  { key: 'to', header: 'To', cell: r => party(r.to) },
  { key: 'dir', header: 'Direction', cell: r => <StatusBadge value={r.direction} /> },
  { key: 'type', header: 'Type', cell: r => (r.transferType ? <Badge variant='outline'>{r.transferType}</Badge> : '—') },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} /> },
  { key: 'note', header: 'Note', cell: r => <span className='text-muted-foreground text-sm'>{r.note ?? ''}</span> }
]

/** Display-only sum of the amounts on this page (the wire carries decimal strings). */
const sumAmounts = (rows: { amount: string }[] | undefined) => rows?.reduce((acc, r) => acc + Number(r.amount || 0), 0) ?? 0

const TransfersTab = () => {
  const { state, set, query } = useListState(['accountType', 'accountId', 'from', 'to'])
  const list = usePagedApi<TransferRow>('admin/accounts/statement', {
    limit: query.limit,
    page: query.page,
    accountType: query.accountId ? query.accountType || 'user' : undefined,
    accountId: query.accountId,
    from: query.from,
    to: query.to
  })
  const rows = list.data?.rows
  const pageTotal = useMemo(() => sumAmounts(rows), [rows])

  return (
    <div className='grid gap-4'>
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard label='Transfers' value={formatNumber(list.data?.pagination.total)} hint='matching the filter' loading={list.isLoading} />
        <StatCard label='This page' value={formatMoney(pageTotal)} hint={`${rows?.length ?? 0} rows summed`} loading={list.isLoading} />
        <StatCard label='Account' value={state.accountId ? `${state.accountType || 'user'} #${state.accountId}` : 'Whole tree'} />
        <StatCard label='Period' value={state.from || state.to ? `${state.from || '…'} → ${state.to || '…'}` : 'All time'} />
      </div>
      <DataTable
        columns={transferColumns}
        rows={rows}
        rowKey={r => r.id}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.error}
        pagination={list.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        toolbar={
          <>
            <Select value={String(state.accountType || 'user')} onValueChange={v => v && set({ accountType: v })}>
              <SelectTrigger className='w-28'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>
                    {t === 'user' ? 'Player' : 'Staff'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder='Account id (blank = whole tree)' className='w-56' value={String(state.accountId ?? '')} onChange={e => set({ accountId: e.target.value.replace(/\D/g, '') })} />
            <Input type='date' className='w-40' value={String(state.from ?? '')} onChange={e => set({ from: e.target.value })} />
            <Input type='date' className='w-40' value={String(state.to ?? '')} onChange={e => set({ to: e.target.value })} />
          </>
        }
        dense
      />
    </div>
  )
}

const statementColumns: Column<StatementRow>[] = [
  { key: 'ts', header: 'When', cell: r => <DateTime value={r.ts} /> },
  { key: 'kind', header: 'Kind', cell: r => <Badge variant='outline'>{r.kind}</Badge> },
  { key: 'label', header: 'Entry', cell: r => <span>{r.label}{r.legacy ? <Badge variant='secondary' className='ml-1 font-normal'>{r.legacy}</Badge> : null}</span> },
  { key: 'party', header: 'Counterparty', cell: r => (typeof r.party === 'string' ? r.party : r.party ? String(r.party.name ?? r.party.id ?? '') : '—') },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} signed /> },
  { key: 'balance', header: 'Balance', align: 'right', cell: r => <Money value={r.balance} /> },
  { key: 'note', header: 'Note', cell: r => <span className='text-muted-foreground text-sm'>{r.note ?? ''}</span> }
]

const StatementTab = () => {
  const [form, setForm] = useState({ subject: 'user', id: '', from: daysAgo(30), to: daysAgo(0), category: 'all' })
  const [applied, setApplied] = useState<typeof form | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)
  const [betKind, setBetKind] = useState('sports')
  const [betPage, setBetPage] = useState(1)

  const base = applied ? (applied.subject === 'user' ? `admin/statements/user/${applied.id}` : `admin/statements/${applied.id}`) : null
  const range = applied ? { from: applied.from || undefined, to: applied.to || undefined } : {}
  const stmt = useApi<Statement>(base ? `${base}/statement` : null, { ...range, category: applied?.category, page, limit })
  const bets = usePagedApi<Record<string, unknown>>(base ? `${base}/bets` : null, { ...range, kind: betKind, page: betPage, limit: 50 })
  const s = stmt.data
  const [downloading, setDownloading] = useState(false)

  const pdf = async () => {
    if (!base || !applied) return
    setDownloading(true)
    try {
      const blob = await api.blob(`${base}/pdf`, { ...range, category: applied.category })

      downloadBlob(blob, `statement-${applied.subject}-${applied.id}.pdf`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setDownloading(false)
    }
  }

  const betRows = bets.data?.rows
  const betKeys = betRows?.length ? Object.keys(betRows[0]) : []
  const betColumns: Column<Record<string, unknown>>[] = betKeys.map(k => ({ key: k, header: k, cell: r => <span className='text-xs'>{typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : String(r[k] ?? '—')}</span> }))

  return (
    <div className='grid gap-4'>
      <Card className='shadow-none'>
        <CardContent className='flex flex-wrap items-end gap-3'>
          <Select value={form.subject} onValueChange={v => v && setForm({ ...form, subject: v })}>
            <SelectTrigger className='w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='user'>Player</SelectItem>
              <SelectItem value='staff'>Staff</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder='Account id' className='w-40' value={form.id} onChange={e => setForm({ ...form, id: e.target.value.replace(/\D/g, '') })} />
          <Input type='date' className='w-40' value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} />
          <Input type='date' className='w-40' value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} />
          <Select value={form.category} onValueChange={v => v && setForm({ ...form, category: v })}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATEMENT_CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!form.id}
            onClick={() => {
              setApplied(form)
              setPage(1)
              setBetPage(1)
            }}
          >
            <SearchIcon /> Load statement
          </Button>
          <Button variant='outline' disabled={!applied || downloading} onClick={pdf}>
            <DownloadIcon /> PDF
          </Button>
        </CardContent>
      </Card>

      {stmt.error && <ErrorState error={stmt.error} />}
      {!applied && <p className='text-muted-foreground text-sm'>Enter a player or staff id and a period to load their statement.</p>}

      {s && (
        <>
          <Card className='shadow-none'>
            <CardHeader>
              <CardTitle className='flex flex-wrap items-center gap-2 text-base'>
                <Link href={s.subject.type === 'USER' ? `/players/${s.subject.id}` : `/staff/${s.subject.id}`} className='hover:underline'>
                  {s.subject.name}
                </Link>
                <Badge variant='secondary'>{s.subject.role}</Badge>
                {s.subject.parentName && <span className='text-muted-foreground text-sm font-normal'>under {s.subject.parentName}</span>}
                <span className='text-muted-foreground ml-auto text-sm font-normal'>
                  {s.period.from ?? 'start'} → {s.period.to ?? 'now'} · {s.category}
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
          <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
            <StatCard label='Opening' value={<Money value={s.balance.opening} />} />
            <StatCard label='Closing' value={<Money value={s.balance.closing} />} hint={<>live <Money value={s.balance.live} /></>} />
            <StatCard label='Total in' value={<Money value={s.balance.totalIn} />} hint={<>deposits <Money value={s.balance.depositIn} /></>} />
            <StatCard label='Total out' value={<Money value={s.balance.totalOut} />} hint={<>withdrawals <Money value={s.balance.withdrawOut} /></>} />
            <StatCard label='Movement' value={<Money value={s.balance.movement} signed />} hint={<>unexplained <Money value={s.balance.unexplained} /></>} />
            <StatCard label='Open exposure' value={<Money value={s.balance.openExposure} />} />
            <StatCard label='Sports P&L' value={<Money value={s.gaming.total.headlineSports} signed />} hint={`${formatNumber(s.gaming.counts.settledBets)} settled · ${formatNumber(s.gaming.counts.openBets)} open`} />
            <StatCard label='Casino P&L' value={<Money value={s.gaming.total.headlineCasino} signed />} hint={`${formatNumber(s.gaming.counts.casinoBets)} bets · ${formatNumber(s.gaming.counts.casinoWins)} wins`} />
          </div>

          <Tabs defaultValue='rows'>
            <TabsList className='mb-4'>
              <TabsTrigger value='rows'>Statement rows</TabsTrigger>
              <TabsTrigger value='bets'>Bets</TabsTrigger>
              <TabsTrigger value='raw'>Everything else</TabsTrigger>
            </TabsList>
            <TabsContent value='rows'>
              <DataTable
                columns={statementColumns}
                rows={s.rows}
                rowKey={r => r.id}
                loading={stmt.isLoading}
                fetching={stmt.isFetching}
                pagination={{ ...s.pagination, hasNext: s.pagination.page < s.pagination.totalPages, hasPrev: s.pagination.page > 1 }}
                onPageChange={setPage}
                onLimitChange={l => {
                  setLimit(l)
                  setPage(1)
                }}
                dense
              />
            </TabsContent>
            <TabsContent value='bets'>
              <DataTable
                columns={betColumns.length ? betColumns : [{ key: 'none', header: 'Bets', cell: () => null }]}
                rows={betRows}
                rowKey={(r, i) => String(r.id ?? i)}
                loading={bets.isLoading}
                error={bets.error}
                pagination={bets.data?.pagination}
                onPageChange={setBetPage}
                toolbar={
                  <Select value={betKind} onValueChange={v => v && (setBetKind(v), setBetPage(1))}>
                    <SelectTrigger className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='sports'>Sports</SelectItem>
                      <SelectItem value='casino'>Casino</SelectItem>
                    </SelectContent>
                  </Select>
                }
                emptyMessage={`No ${betKind} bets in this period.`}
                dense
              />
            </TabsContent>
            <TabsContent value='raw'>
              <JsonView value={{ balance: s.balance, gaming: s.gaming, daily: s.daily, sportsDaily: s.sportsDaily, casinoDaily: s.casinoDaily, players: s.players }} className='max-h-[32rem]' />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

const Statements = () => (
  <div>
    <PageHeader title='Statements' description='Transfers between accounts in your tree, and the full account statement ("hisab") for one player or staff member.' />
    <Tabs defaultValue='statement'>
      <TabsList className='mb-4'>
        <TabsTrigger value='statement'>Account statement</TabsTrigger>
        <TabsTrigger value='transfers'>Transfers</TabsTrigger>
      </TabsList>
      <TabsContent value='statement'>
        <StatementTab />
      </TabsContent>
      <TabsContent value='transfers'>
        <TransfersTab />
      </TabsContent>
    </Tabs>
  </div>
)

export default Statements
