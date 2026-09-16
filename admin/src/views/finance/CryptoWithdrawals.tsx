'use client'

import { useState } from 'react'

import Link from 'next/link'

import { EyeIcon, GavelIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import FormDialog from '@/components/shared/FormDialog'
import { SelectField, TextAreaField, TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatNumber, truncateId } from '@/lib/format'
import { DateInput, Details, ViewDialog, stop } from './shared'
import { CRYPTO_WITHDRAW_STATUSES, type CryptoWithdrawSummary, type CryptoWithdrawalRow } from './types'

const LIST = 'admin/user/withdrawals/crypto'
const SUMMARY = `${LIST}/summary`

/** Legal moves (`cryptoWithdraw.constants.TRANSITIONS`): In Queue → Approved/Rejected; Approved → Sent/Rejected. */
const NEXT: Record<string, string[]> = { 'In Queue': ['Approved', 'Rejected'], Approved: ['Sent', 'Rejected'] }

/** `POST admin/user/withdrawals/crypto/:id/decision { status, txid?, comment? }`. */
const Decide = ({ row }: { row: CryptoWithdrawalRow }) => {
  const options = NEXT[row.status] ?? []
  const [form, setForm] = useState({ status: options[0] ?? '', txid: '', comment: '' })
  const decide = useApiMutation({
    fn: () => {
      const body: Record<string, string> = { status: form.status }

      if (form.txid) body.txid = form.txid
      if (form.comment) body.comment = form.comment

      return api.post(`${LIST}/${row.id}/decision`, body)
    },
    invalidate: [['paged', LIST], ['api', SUMMARY]],
    success: `Withdrawal #${row.id} updated`
  })

  return (
    <FormDialog
      trigger={
        <Button size='sm'>
          <GavelIcon /> Decide
        </Button>
      }
      title={`Withdrawal #${row.id}`}
      description={
        <>
          <Money value={row.amount} currency={row.coin} /> to <span className='font-mono'>{row.wallet}</span>. Approved is the instruction to send coin; Sent records the on-chain hash; Rejected returns the held balance to the player.
        </>
      }
      submitLabel='Apply'
      destructive={form.status === 'Rejected'}
      onSubmit={() => decide.mutateAsync()}
    >
      <SelectField id={`cw-st-${row.id}`} label='New status' value={form.status} onChange={status => setForm({ ...form, status })} options={options.map(v => ({ value: v, label: v }))} />
      <TextField id={`cw-tx-${row.id}`} label='Transaction hash' hint='16–120 alphanumerics; record it when marking as Sent' value={form.txid} onChange={e => setForm({ ...form, txid: e.target.value })} required={form.status === 'Sent'} />
      <TextAreaField id={`cw-c-${row.id}`} label='Note' hint='The player can read this (it is the reason a payout was refused)' value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} />
    </FormDialog>
  )
}

const Detail = ({ row }: { row: CryptoWithdrawalRow }) => (
  <ViewDialog
    trigger={
      <Button variant='ghost' size='sm'>
        <EyeIcon /> View
      </Button>
    }
    title={`Withdrawal #${row.id}`}
    description={
      <span className='inline-flex items-center gap-2'>
        <StatusBadge value={row.status} /> <DateTime value={row.date} />
      </span>
    }
  >
    <Details
      items={[
        ['Player', <Link key='p' href={`/players/${row.userId}`} className='underline'>#{row.userId}</Link>],
        ['Amount', <Money key='a' value={row.amount} currency={row.coin} />],
        ['Chain', row.chain],
        ['Wallet', <span key='w' className='font-mono text-xs'>{row.wallet}</span>],
        ['Tx hash', <span key='t' className='font-mono text-xs'>{row.txid}</span>],
        ['Note', row.note],
        ['Decided by', row.decidedBy ? `#${row.decidedBy}` : null],
        ['Decided at', row.decidedAt ? <DateTime key='d' value={row.decidedAt} /> : null]
      ]}
    />
  </ViewDialog>
)

const columns: Column<CryptoWithdrawalRow>[] = [
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>{r.id}</span> },
  { key: 'user', header: 'Player', cell: r => <Link href={`/players/${r.userId}`} className='font-mono text-xs hover:underline'>#{r.userId}</Link> },
  { key: 'coin', header: 'Coin', cell: r => <span className='text-sm'>{r.coin}{r.chain ? <span className='text-muted-foreground'> · {r.chain}</span> : null}</span> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.coin} /> },
  { key: 'wallet', header: 'Address', cell: r => <span className='font-mono text-xs' title={r.wallet}>{truncateId(r.wallet, 8)}</span> },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'txid', header: 'Tx hash', cell: r => <span className='font-mono text-xs' title={r.txid ?? ''}>{truncateId(r.txid, 6)}</span> },
  { key: 'at', header: 'Requested', cell: r => <DateTime value={r.date} /> },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (
      <div className='flex justify-end gap-1' onClick={stop}>
        <Detail row={r} />
        {NEXT[r.status]?.length ? (
          <Can permission='withdrawals:approve'>
            <Decide row={r} />
          </Can>
        ) : null}
      </div>
    )
  }
]

const CryptoWithdrawals = () => {
  const { state, set, query } = useListState(['status', 'userId', 'coin', 'from', 'to'], { status: 'In Queue' })
  const list = usePagedApi<CryptoWithdrawalRow>(LIST, { limit: query.limit, page: query.page, status: query.status, userId: query.userId, coin: query.coin, from: query.from, to: query.to })
  const summary = useApi<CryptoWithdrawSummary[]>(SUMMARY)
  const byStatus = (status: string) => {
    const rows = (summary.data ?? []).filter(r => r.status === status)

    return { count: rows.reduce((n, r) => n + r.count, 0), hint: rows.map(r => `${r.total} ${r.coin}`).join(' · ') || '—' }
  }

  return (
    <div>
      <PageHeader title='Crypto withdrawals' description='On-chain payout requests. Approve → send coin → mark Sent with the hash. Rejecting returns the held balance.' />
      <div className='mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {CRYPTO_WITHDRAW_STATUSES.map(s => {
          const v = byStatus(s)

          return <StatCard key={s} label={s} value={formatNumber(v.count)} hint={v.hint} loading={summary.isLoading} />
        })}
      </div>
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
        emptyMessage={state.status ? `Nothing ${String(state.status).toLowerCase()}.` : 'No withdrawal requests.'}
        toolbar={
          <>
            <Select value={String(state.status || 'all')} onValueChange={v => v && set({ status: v === 'all' ? '' : v })}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All statuses</SelectItem>
                {CRYPTO_WITHDRAW_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder='Coin' aria-label='Coin' value={String(state.coin ?? '')} onChange={e => set({ coin: e.target.value.toUpperCase() })} className='w-24' />
            <Input placeholder='Player id' aria-label='Player id' inputMode='numeric' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} className='w-28' />
            <DateInput value={String(state.from ?? '')} onChange={from => set({ from })} placeholder='From' />
            <DateInput value={String(state.to ?? '')} onChange={to => set({ to })} placeholder='To' />
          </>
        }
      />
    </div>
  )
}

export default CryptoWithdrawals
