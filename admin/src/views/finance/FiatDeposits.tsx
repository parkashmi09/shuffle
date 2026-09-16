'use client'

import { useState } from 'react'

import Link from 'next/link'

import { CheckIcon, EyeIcon, XIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import FormDialog from '@/components/shared/FormDialog'
import { TextAreaField, TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import { Details, ImageDialog, ViewDialog, stop } from './shared'
import { FIAT_CURRENCIES, type DepositStats, type FiatDepositRow } from './types'

const LIST = 'admin/user/deposits/fiat'
const INVALIDATE = [['paged', LIST], ['api', 'admin/user/history/fiat/stats']]

/** The server mounts approve/reject behind `deposits:approve`; the inventory lists `withdrawals:approve`. Either shows the buttons; the platform decides. */
const APPROVE = ['deposits:approve', 'withdrawals:approve']

const Approve = ({ row }: { row: FiatDepositRow }) => {
  const [form, setForm] = useState({ creditAmount: '', comment: '' })
  const approve = useApiMutation({
    fn: () => {
      const body: Record<string, string> = {}

      if (form.creditAmount) body.creditAmount = form.creditAmount
      if (form.comment) body.comment = form.comment

      return api.put(`${LIST}/${row.depositId}/approve`, body)
    },
    invalidate: INVALIDATE,
    success: 'Deposit approved and credited'
  })

  return (
    <FormDialog
      trigger={
        <Button size='sm'>
          <CheckIcon /> Approve
        </Button>
      }
      title={`Approve deposit #${row.depositId}`}
      description={
        <>
          Credits player #{row.userId} with <Money value={row.amount} currency={row.currency} /> unless you enter a different amount below (when the bank statement disagrees).
        </>
      }
      submitLabel='Approve & credit'
      onSubmit={() => approve.mutateAsync()}
    >
      <TextField id={`ap-amt-${row.depositId}`} label='Credit amount' placeholder={row.amount} hint='Leave blank to credit the claimed amount' value={form.creditAmount} onChange={e => setForm({ ...form, creditAmount: e.target.value })} />
      <TextAreaField id={`ap-c-${row.depositId}`} label='Comment' value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} />
    </FormDialog>
  )
}

const Reject = ({ row }: { row: FiatDepositRow }) => {
  const [comment, setComment] = useState('')
  const reject = useApiMutation({
    fn: () => api.put(`${LIST}/${row.depositId}/reject`, { comment }),
    invalidate: INVALIDATE,
    success: 'Deposit rejected'
  })

  return (
    <FormDialog
      trigger={
        <Button size='sm' variant='destructive'>
          <XIcon /> Reject
        </Button>
      }
      title={`Reject deposit #${row.depositId}`}
      description='The player sees this reason on their deposit history.'
      submitLabel='Reject'
      destructive
      onSubmit={() => reject.mutateAsync()}
    >
      <TextAreaField id={`rj-c-${row.depositId}`} label='Reason' required value={comment} onChange={e => setComment(e.target.value)} />
    </FormDialog>
  )
}

const Detail = ({ row }: { row: FiatDepositRow }) => (
  <ViewDialog
    trigger={
      <Button variant='ghost' size='sm'>
        <EyeIcon /> View
      </Button>
    }
    title={`Deposit #${row.depositId}`}
    description={
      <span className='inline-flex items-center gap-2'>
        <StatusBadge value={row.status} /> <DateTime value={row.createdAt} />
      </span>
    }
  >
    <Details
      items={[
        ['Player', <Link key='p' href={`/players/${row.userId}`} className='underline'>#{row.userId}</Link>],
        ['Amount', <Money key='a' value={row.amount} currency={row.currency} />],
        ['Bank reference', <span key='t' className='font-mono'>{row.transactionId}</span>],
        ['Bank', row.bankName],
        ['Account holder', row.accountHolderName],
        ['Account number', row.accountNumber],
        ['IFSC', row.ifscCode],
        ['UPI id', row.upiId],
        ['Admin comment', row.adminComment],
        ['Handled by', row.handledBy ? `#${row.handledBy}` : null],
        ['Handled at', row.handledAt ? <DateTime key='h' value={row.handledAt} /> : null]
      ]}
    />
    {row.hasScreenshot ? (
      <div className='mt-2'>
        <ImageDialog path={`${LIST}/${row.depositId}/screenshot`} title={`Proof of payment — deposit #${row.depositId}`} label='View screenshot' />
      </div>
    ) : (
      <p className='text-muted-foreground text-xs'>No proof of payment was uploaded.</p>
    )}
  </ViewDialog>
)

const columns: Column<FiatDepositRow>[] = [
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>{r.depositId}</span> },
  { key: 'user', header: 'Player', cell: r => <Link href={`/players/${r.userId}`} className='font-mono text-xs hover:underline'>#{r.userId}</Link> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
  { key: 'ref', header: 'Bank reference', cell: r => <span className='font-mono text-xs'>{r.transactionId}</span> },
  { key: 'bank', header: 'Bank / UPI', cell: r => <span className='text-sm'>{r.bankName ?? r.upiId ?? '—'}</span> },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'proof', header: 'Proof', cell: r => (r.hasScreenshot ? <span className='text-xs'>yes</span> : <span className='text-muted-foreground text-xs'>none</span>) },
  { key: 'at', header: 'Created', cell: r => <DateTime value={r.createdAt} /> },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (
      <div className='flex justify-end gap-1' onClick={stop}>
        <Detail row={r} />
        {r.status === 'pending' && (
          <Can permission={APPROVE}>
            <Approve row={r} />
            <Reject row={r} />
          </Can>
        )}
      </div>
    )
  }
]

const FiatDeposits = () => {
  const { can } = useSession()
  const { state, set, query } = useListState(['status', 'currency', 'userId'], { status: 'pending' })
  const list = usePagedApi<FiatDepositRow>(LIST, {
    limit: query.limit,
    page: query.page,
    status: query.status,
    currency: query.currency,
    userId: query.userId,
    search: query.search
  })
  const stats = useApi<DepositStats>('admin/user/history/fiat/stats', { currency: query.currency }, { enabled: can('reports:read') })
  const s = stats.data

  return (
    <div>
      <PageHeader title='Fiat deposits' description='Manual bank-transfer deposits awaiting review. Approving credits the player; rejecting records a reason they can see.' />
      {can('reports:read') && (
        <div className='mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4'>
          <StatCard label='Transactions' value={formatNumber(s?.totalTransactions)} loading={stats.isLoading} hint={`${formatNumber(s?.successfulTransactions)} successful · ${formatNumber(s?.processingTransactions)} processing · ${formatNumber(s?.failedTransactions)} failed`} />
          <StatCard label='Total amount' value={<Money value={s?.totalAmount} currency={s?.currency} />} loading={stats.isLoading} />
          <StatCard label='Successful amount' value={<Money value={s?.successfulAmount} currency={s?.currency} />} loading={stats.isLoading} />
          <StatCard label='Pending amount' value={<Money value={s?.processingAmount} currency={s?.currency} />} loading={stats.isLoading} />
        </div>
      )}
      <DataTable
        columns={columns}
        rows={list.data?.rows}
        rowKey={r => r.depositId}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.error}
        pagination={list.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        search={String(state.search ?? '')}
        onSearchChange={search => set({ search })}
        searchPlaceholder='Bank reference, holder…'
        emptyMessage={state.status ? `No ${state.status} deposits.` : 'No deposits.'}
        toolbar={
          <>
            <Select value={String(state.status || 'all')} onValueChange={v => v && set({ status: v === 'all' ? '' : v })}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                <SelectItem value='pending'>Pending</SelectItem>
                <SelectItem value='approved'>Approved</SelectItem>
                <SelectItem value='rejected'>Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(state.currency || 'all')} onValueChange={v => v && set({ currency: v === 'all' ? '' : v })}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All currencies</SelectItem>
                {FIAT_CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder='Player id' inputMode='numeric' aria-label='Player id' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} className='w-28' />
          </>
        }
      />
    </div>
  )
}

export default FiatDeposits
