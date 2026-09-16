'use client'

import { useState } from 'react'

import Link from 'next/link'

import { SearchIcon, WrenchIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import FormDialog from '@/components/shared/FormDialog'
import { TextField } from '@/components/shared/FormField'
import JsonView from '@/components/shared/JsonView'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { truncateId } from '@/lib/format'
import { DateInput } from './shared'
import { PSP_PROVIDERS, type PaymentOrderRow, type RailTransactionRow } from './types'

/** `POST admin/user/payments/utr-repair { reference, utr }` — attaches a bank UTR to a provider order. */
const UtrRepair = ({ reference: initial = '' }: { reference?: string }) => {
  const [form, setForm] = useState({ reference: initial, utr: '' })
  const repair = useApiMutation({
    fn: () => api.post('admin/user/payments/utr-repair', { reference: form.reference, utr: form.utr }),
    invalidate: [['paged']],
    success: 'UTR attached to the order',
    onSuccess: () => setForm(f => ({ ...f, utr: '' }))
  })

  return (
    <FormDialog
      trigger={
        <Button variant='outline' size={initial ? 'sm' : 'default'}>
          <WrenchIcon /> UTR repair
        </Button>
      }
      title='Attach a bank UTR to an order'
      description='Use when a player paid but the gateway callback never carried the bank reference. Audited: a UTR is the evidence a payment happened.'
      submitLabel='Attach UTR'
      onSubmit={() => repair.mutateAsync()}
    >
      <TextField id='utr-ref' label='Order reference' required value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
      <TextField id='utr-utr' label='Bank UTR' required minLength={6} maxLength={40} hint='6–40 letters and digits' value={form.utr} onChange={e => setForm({ ...form, utr: e.target.value })} />
    </FormDialog>
  )
}

const orderColumns: Column<PaymentOrderRow>[] = [
  { key: 'provider', header: 'Provider', cell: r => <span className='text-sm'>{r.provider}</span> },
  { key: 'flow', header: 'Flow', cell: r => <StatusBadge value={r.flow} /> },
  { key: 'ref', header: 'Reference', cell: r => <span className='font-mono text-xs' title={r.reference}>{truncateId(r.reference, 10)}</span> },
  { key: 'pref', header: 'Provider ref', cell: r => <span className='font-mono text-xs' title={r.providerReference ?? ''}>{truncateId(r.providerReference, 8)}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
  { key: 'status', header: 'Status', cell: r => <span className='inline-flex items-center gap-1'><StatusBadge value={r.status} />{r.rawStatus && r.rawStatus !== r.status && <span className='text-muted-foreground text-xs'>({r.rawStatus})</span>}</span> },
  { key: 'at', header: 'Created', cell: r => <DateTime value={r.createdAt} /> },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (
      <Can permission='deposits:approve'>
        <UtrRepair reference={r.reference} />
      </Can>
    )
  }
]

/** One player's provider orders — `admin/user/payments/users/:userId/orders`. */
const PlayerOrders = () => {
  const { state, set, query } = useListState(['userId', 'flow'])
  const userId = String(state.userId ?? '')
  const [draft, setDraft] = useState(userId)
  const list = usePagedApi<PaymentOrderRow>(userId ? `admin/user/payments/users/${userId}/orders` : null, { limit: query.limit, page: query.page, flow: query.flow })

  return (
    <DataTable
      columns={orderColumns}
      rows={list.data?.rows}
      rowKey={(r, i) => `${r.provider}-${r.reference}-${i}`}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      emptyMessage={userId ? 'No provider orders for this player.' : 'Enter a player id to look up their gateway orders.'}
      toolbar={
        <form
          className='flex flex-wrap items-center gap-2'
          onSubmit={e => {
            e.preventDefault()
            set({ userId: draft })
          }}
        >
          <Input placeholder='Player id' aria-label='Player id' inputMode='numeric' value={draft} onChange={e => setDraft(e.target.value.replace(/\D/g, ''))} className='w-32' />
          <Button type='submit' variant='outline'>
            <SearchIcon /> Look up
          </Button>
          <Select value={String(state.flow || 'all')} onValueChange={v => v && set({ flow: v === 'all' ? '' : v })}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Pay-in & out</SelectItem>
              <SelectItem value='payin'>Pay-in</SelectItem>
              <SelectItem value='payout'>Pay-out</SelectItem>
            </SelectContent>
          </Select>
        </form>
      }
    />
  )
}

const railColumns: Column<RailTransactionRow>[] = [
  { key: 'provider', header: 'Provider', cell: r => <span className='text-sm'>{r.provider}</span> },
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>{r.id}</span> },
  { key: 'user', header: 'Player', cell: r => <Link href={`/players/${r.userId}`} className='font-mono text-xs hover:underline'>#{r.userId}</Link> },
  { key: 'ref', header: 'Reference', cell: r => <span className='font-mono text-xs' title={r.reference ?? ''}>{truncateId(r.reference, 10)}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
  { key: 'status', header: 'Status', cell: r => <span className='inline-flex items-center gap-1'><StatusBadge value={r.status} />{r.rawStatus && r.rawStatus !== r.status && <span className='text-muted-foreground text-xs'>({r.rawStatus})</span>}</span> },
  { key: 'at', header: 'Created', cell: r => <DateTime value={r.createdAt} /> },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (r.reference ? (
      <Can permission='deposits:approve'>
        <UtrRepair reference={r.reference} />
      </Can>
    ) : null)
  }
]

/** Every rail merged — `admin/user/history/deposits` or `/withdrawals` (limit, offset, from, to, currency, userId, status). */
const AllRails = ({ kind }: { kind: 'deposits' | 'withdrawals' }) => {
  const { state, set, query } = useListState(['status', 'userId', 'from', 'to'])
  const list = usePagedApi<RailTransactionRow>(`admin/user/history/${kind}`, { limit: query.limit, page: query.page, status: query.status, userId: query.userId, from: query.from, to: query.to })

  return (
    <DataTable
      columns={railColumns}
      rows={list.data?.rows}
      rowKey={(r, i) => `${r.provider}-${r.id}-${i}`}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      toolbar={
        <>
          <Input placeholder='Status (success, pending, failed…)' aria-label='Status' value={String(state.status ?? '')} onChange={e => set({ status: e.target.value })} className='w-56' />
          <Input placeholder='Player id' aria-label='Player id' inputMode='numeric' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} className='w-28' />
          <DateInput value={String(state.from ?? '')} onChange={from => set({ from })} placeholder='From' />
          <DateInput value={String(state.to ?? '')} onChange={to => set({ to })} placeholder='To' />
        </>
      }
    />
  )
}

/** `admin/user/psp/:provider/status/:reference` — asks the provider directly. */
const PspProbe = () => {
  const [form, setForm] = useState({ provider: PSP_PROVIDERS[0] as string, reference: '' })
  const [probe, setProbe] = useState<{ provider: string; reference: string } | null>(null)
  const q = useApi<unknown>(probe ? `admin/user/psp/${probe.provider}/status/${encodeURIComponent(probe.reference)}` : null)

  return (
    <Card className='shadow-none'>
      <CardHeader>
        <CardTitle className='text-base'>Provider status probe</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <form
          className='flex flex-wrap items-end gap-2'
          onSubmit={e => {
            e.preventDefault()
            if (form.reference.trim()) setProbe({ provider: form.provider, reference: form.reference.trim() })
          }}
        >
          <Select value={form.provider} onValueChange={v => v && setForm({ ...form, provider: v })}>
            <SelectTrigger className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PSP_PROVIDERS.map(p => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder='Order reference' aria-label='Order reference' value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className='w-72' />
          <Button type='submit' variant='outline' disabled={q.isFetching}>
            <SearchIcon /> Probe
          </Button>
        </form>
        {q.error && <ErrorState error={q.error} title='Provider did not answer' />}
        {q.data !== undefined && <JsonView value={q.data} />}
      </CardContent>
    </Card>
  )
}

const PaymentOrders = () => (
  <div>
    <PageHeader
      title='Payment orders'
      description='Gateway (PSP) orders across every rail, a per-player order lookup, UTR repair and a live provider status probe.'
      actions={
        <Can permission='deposits:approve'>
          <UtrRepair />
        </Can>
      }
    />
    <Tabs defaultValue='deposits'>
      <TabsList className='mb-4 flex-wrap'>
        <TabsTrigger value='deposits'>Gateway deposits</TabsTrigger>
        <TabsTrigger value='withdrawals'>Gateway payouts</TabsTrigger>
        <TabsTrigger value='player'>By player</TabsTrigger>
        <TabsTrigger value='probe'>Provider probe</TabsTrigger>
      </TabsList>
      <TabsContent value='deposits'>
        <AllRails kind='deposits' />
      </TabsContent>
      <TabsContent value='withdrawals'>
        <AllRails kind='withdrawals' />
      </TabsContent>
      <TabsContent value='player'>
        <PlayerOrders />
      </TabsContent>
      <TabsContent value='probe'>
        <PspProbe />
      </TabsContent>
    </Tabs>
  </div>
)

export default PaymentOrders
