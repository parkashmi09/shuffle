'use client'

import { useState } from 'react'

import Link from 'next/link'

import { PlusIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import FormDialog from '@/components/shared/FormDialog'
import { SelectField, TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation, useListState } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatNumber, truncateId } from '@/lib/format'
import { DateInput, usePageNumbered } from './shared'
import type { CryptoDepositRow, DepositStats } from './types'

const LIST = 'admin/user/history/crypto/deposits'

/** `POST admin/user/crypto/inr-deposits` — a staff-entered INR credit for an on-chain deposit. */
const RecordInrDeposit = () => {
  const [form, setForm] = useState({ userId: '', amount: '', transactionId: '', status: 'pending', date: '' })
  const record = useApiMutation({
    fn: () => {
      const body: Record<string, string | number> = { userId: Number(form.userId), amount: form.amount, transactionId: form.transactionId, status: form.status }

      if (form.date) body.date = form.date

      return api.post('admin/user/crypto/inr-deposits', body)
    },
    invalidate: [['paged', LIST], ['api', 'admin/user/history/crypto/stats']],
    success: 'INR deposit recorded',
    onSuccess: () => setForm({ userId: '', amount: '', transactionId: '', status: 'pending', date: '' })
  })

  return (
    <FormDialog
      trigger={
        <Button>
          <PlusIcon /> Record INR deposit
        </Button>
      }
      title='Record an INR deposit'
      description='Enters a deposit the player made out of band. Audited under your name; only "success" counts as money that arrived.'
      submitLabel='Record'
      onSubmit={() => record.mutateAsync()}
    >
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='ir-user' label='Player id' required inputMode='numeric' value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value.replace(/\D/g, '') })} />
        <TextField id='ir-amt' label='Amount (INR)' required placeholder='1000.00' value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
      </div>
      <TextField id='ir-tx' label='Transaction id' required value={form.transactionId} onChange={e => setForm({ ...form, transactionId: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <SelectField id='ir-status' label='Status' value={form.status} onChange={status => setForm({ ...form, status })} options={['pending', 'success', 'failed'].map(v => ({ value: v, label: v }))} />
        <TextField id='ir-date' label='Date' type='date' value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
      </div>
    </FormDialog>
  )
}

const columns: Column<CryptoDepositRow>[] = [
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>{r.id}</span> },
  { key: 'user', header: 'Player', cell: r => <Link href={`/players/${r.userId}`} className='font-mono text-xs hover:underline'>#{r.userId}</Link> },
  { key: 'chain', header: 'Chain', cell: r => <span className='text-sm'>{r.chain ?? '—'}</span> },
  { key: 'usd', header: 'Amount (USD)', align: 'right', cell: r => <Money value={r.amountUsd} currency='USD' /> },
  { key: 'inr', header: 'Amount (INR)', align: 'right', cell: r => <Money value={r.amountInr} currency='INR' /> },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'order', header: 'Order', cell: r => <span className='font-mono text-xs' title={r.orderId ?? ''}>{truncateId(r.orderId)}</span> },
  { key: 'addr', header: 'Address', cell: r => <span className='font-mono text-xs' title={r.address ?? ''}>{truncateId(r.address, 6)}</span> },
  { key: 'at', header: 'Created', cell: r => <DateTime value={r.createdAt} /> }
]

const CryptoDeposits = () => {
  const { can } = useSession()
  const { state, set, query } = useListState(['status', 'chain', 'userid', 'startDate', 'endDate'])
  const range = { startDate: query.startDate, endDate: query.endDate }
  const list = usePageNumbered<CryptoDepositRow>(LIST, { limit: query.limit, page: query.page, status: query.status, chain: query.chain, userid: query.userid, ...range })
  const stats = useApi<DepositStats>('admin/user/history/crypto/stats', range, { enabled: can('reports:read') })
  const s = stats.data

  return (
    <div>
      <PageHeader
        title='Crypto deposits'
        description='On-chain deposits seen by the payment provider, scoped to your agent tree. USD is what the chain moved; INR is at the current rate.'
        actions={
          <Can permission='deposits:approve'>
            <RecordInrDeposit />
          </Can>
        }
      />
      {can('reports:read') && (
        <div className='mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4'>
          <StatCard label='Transactions' value={formatNumber(s?.totalTransactions)} loading={stats.isLoading} hint={`${formatNumber(s?.successfulTransactions)} successful · ${formatNumber(s?.processingTransactions)} processing · ${formatNumber(s?.failedTransactions)} failed`} />
          <StatCard label='Total amount' value={<Money value={s?.totalAmount} currency={s?.currency} />} loading={stats.isLoading} />
          <StatCard label='Successful amount' value={<Money value={s?.successfulAmount} currency={s?.currency} />} loading={stats.isLoading} />
          <StatCard label='Processing amount' value={<Money value={s?.processingAmount} currency={s?.currency} />} loading={stats.isLoading} />
        </div>
      )}
      <DataTable
        columns={columns}
        rows={list.data?.rows}
        rowKey={r => r.id}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.error}
        pagination={list.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        toolbar={
          <>
            <Select value={String(state.status || 'all')} onValueChange={v => v && set({ status: v === 'all' ? '' : v })}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                <SelectItem value='success'>Success</SelectItem>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='failed'>Failed</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder='Chain' aria-label='Chain' value={String(state.chain ?? '')} onChange={e => set({ chain: e.target.value })} className='w-28' />
            <Input placeholder='Player id' aria-label='Player id' inputMode='numeric' value={String(state.userid ?? '')} onChange={e => set({ userid: e.target.value.replace(/\D/g, '') })} className='w-28' />
            <DateInput value={String(state.startDate ?? '')} onChange={startDate => set({ startDate })} placeholder='From' />
            <DateInput value={String(state.endDate ?? '')} onChange={endDate => set({ endDate })} placeholder='To' />
          </>
        }
      />
    </div>
  )
}

export default CryptoDeposits
