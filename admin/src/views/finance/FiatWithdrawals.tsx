'use client'

import { useState } from 'react'

import Link from 'next/link'

import { EyeIcon, GavelIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import FormDialog from '@/components/shared/FormDialog'
import { SelectField, TextAreaField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { Details, ViewDialog, stop } from './shared'
import { FIAT_WITHDRAW_STATUSES, type FiatWithdrawalRow } from './types'

const LIST = 'admin/user/withdrawals/fiat'

/** `POST admin/user/withdrawals/fiat/status { withdrawalId, status, comment? }`. Rejected refunds the held funds. */
const Decide = ({ row }: { row: FiatWithdrawalRow }) => {
  const [form, setForm] = useState({ status: row.status === 'In Queue' ? 'Approved' : row.status, comment: '' })
  const decide = useApiMutation({
    fn: () => {
      const body: Record<string, string | number> = { withdrawalId: row.withdrawalId, status: form.status }

      if (form.comment) body.comment = form.comment

      return api.post(`${LIST}/status`, body)
    },
    invalidate: [['paged', LIST]],
    success: r => `Withdrawal #${row.withdrawalId} marked ${(r as { status?: string } | undefined)?.status ?? form.status}`
  })

  return (
    <FormDialog
      trigger={
        <Button size='sm'>
          <GavelIcon /> Decide
        </Button>
      }
      title={`Withdrawal #${row.withdrawalId}`}
      description={
        <>
          <Money value={row.amount} currency={row.currency} /> to {row.accountHolderName ?? 'the player'}. Approving means the operator is about to pay; Paid records that it went out; Rejected returns the held funds to the player.
        </>
      }
      submitLabel='Apply status'
      destructive={form.status === 'Rejected'}
      onSubmit={() => decide.mutateAsync()}
    >
      <SelectField id={`fw-st-${row.withdrawalId}`} label='New status' value={form.status} onChange={status => setForm({ ...form, status })} options={FIAT_WITHDRAW_STATUSES.map(v => ({ value: v, label: v }))} />
      <TextAreaField id={`fw-c-${row.withdrawalId}`} label='Comment' hint='Recorded on the audit trail' value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} />
    </FormDialog>
  )
}

const Detail = ({ row }: { row: FiatWithdrawalRow }) => (
  <ViewDialog
    trigger={
      <Button variant='ghost' size='sm'>
        <EyeIcon /> View
      </Button>
    }
    title={`Withdrawal #${row.withdrawalId}`}
    description={
      <span className='inline-flex items-center gap-2'>
        <StatusBadge value={row.status} /> <DateTime value={row.requestedAt} />
      </span>
    }
  >
    <Details
      items={[
        ['Player', <Link key='p' href={`/players/${row.userId}`} className='underline'>#{row.userId}</Link>],
        ['Amount', <Money key='a' value={row.amount} currency={row.currency} />],
        ['Account holder', row.accountHolderName],
        ['Bank', row.bankName],
        ['Account number', <span key='n' className='font-mono'>{row.accountNumber}</span>],
        ['IFSC', <span key='i' className='font-mono'>{row.ifscCode}</span>],
        ['UPI id', row.upiId]
      ]}
    />
  </ViewDialog>
)

const columns: Column<FiatWithdrawalRow>[] = [
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>{r.withdrawalId}</span> },
  { key: 'user', header: 'Player', cell: r => <Link href={`/players/${r.userId}`} className='font-mono text-xs hover:underline'>#{r.userId}</Link> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
  { key: 'holder', header: 'Account holder', cell: r => <span className='text-sm'>{r.accountHolderName ?? '—'}</span> },
  { key: 'bank', header: 'Bank / UPI', cell: r => <span className='text-sm'>{r.bankName ?? r.upiId ?? '—'}</span> },
  { key: 'acct', header: 'Account', cell: r => <span className='font-mono text-xs'>{r.accountNumber ?? '—'}{r.ifscCode ? ` · ${r.ifscCode}` : ''}</span> },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'at', header: 'Requested', cell: r => <DateTime value={r.requestedAt} /> },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (
      <div className='flex justify-end gap-1' onClick={stop}>
        <Detail row={r} />
        {r.status !== 'Paid' && r.status !== 'Rejected' && (
          <Can permission='withdrawals:approve'>
            <Decide row={r} />
          </Can>
        )}
      </div>
    )
  }
]

const FiatWithdrawals = () => {
  const { state, set, query } = useListState(['status', 'userId'], { status: 'In Queue' })
  const list = usePagedApi<FiatWithdrawalRow>(LIST, { limit: query.limit, page: query.page, status: query.status, userId: query.userId })

  return (
    <div>
      <PageHeader title='Fiat withdrawals' description='Bank payout requests. Funds are held when the player asks; a rejection releases them back.' />
      <DataTable
        columns={columns}
        rows={list.data?.rows}
        rowKey={r => r.withdrawalId}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.error}
        pagination={list.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        emptyMessage={state.status ? `Nothing ${String(state.status).toLowerCase()}.` : 'No withdrawal requests.'}
        toolbar={
          <>
            <Select value={String(state.status || 'all')} onValueChange={v => v && set({ status: v === 'all' ? '' : v })}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                {FIAT_WITHDRAW_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder='Player id' aria-label='Player id' inputMode='numeric' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} className='w-28' />
          </>
        }
      />
    </div>
  )
}

export default FiatWithdrawals
