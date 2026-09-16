'use client'

import Link from 'next/link'

import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi, useListState, usePagedApi } from '@/hooks/use-api'
import { formatNumber } from '@/lib/format'
import { DateInput } from './shared'
import type { StaffTransferRow, TransferSummary } from './types'

const LIST = 'admin/staff/transfers'

const Party = ({ p }: { p: StaffTransferRow['from'] }) => {
  const href = p.type === 'user' ? `/players/${p.id}` : `/staff/${p.id}`

  return (
    <Link href={href} className='text-sm hover:underline' onClick={e => e.stopPropagation()}>
      {p.name ?? `${p.type} #${p.id}`}
      <span className='text-muted-foreground ml-1 font-mono text-xs'>{p.type} #{p.id}</span>
    </Link>
  )
}

const columns: Column<StaffTransferRow>[] = [
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>{r.id}</span> },
  { key: 'at', header: 'When', cell: r => <DateTime value={r.createdAt} /> },
  { key: 'dir', header: 'Direction', cell: r => <StatusBadge value={r.direction} /> },
  { key: 'from', header: 'From', cell: r => <Party p={r.from} /> },
  { key: 'to', header: 'To', cell: r => <Party p={r.to} /> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency='INR' /> },
  { key: 'type', header: 'Type', cell: r => <span className='text-muted-foreground text-sm'>{r.transferType ?? '—'}</span> }
]

const Transfers = () => {
  const { state, set, query } = useListState(['staffId', 'direction', 'from', 'to'])
  const filters = { staffId: query.staffId, from: query.from, to: query.to }
  const list = usePagedApi<StaffTransferRow>(LIST, { limit: query.limit, page: query.page, direction: query.direction, ...filters })
  const summary = useApi<TransferSummary[]>(`${LIST}/summary`, filters)
  const sum = (direction: string) => summary.data?.find(s => s.direction === direction)

  return (
    <div>
      <PageHeader title='Staff transfers' description='Balance moved down the agent tree (deposit) and pulled back up (withdraw), between staff accounts and their players.' />
      <div className='mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard label='Deposits' value={<Money value={sum('deposit')?.total ?? '0'} currency='INR' />} hint={`${formatNumber(sum('deposit')?.count ?? 0)} transfers`} loading={summary.isLoading} />
        <StatCard label='Withdrawals' value={<Money value={sum('withdraw')?.total ?? '0'} currency='INR' />} hint={`${formatNumber(sum('withdraw')?.count ?? 0)} transfers`} loading={summary.isLoading} />
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
        toolbar={
          <>
            <Input placeholder='Staff id' aria-label='Staff id' inputMode='numeric' value={String(state.staffId ?? '')} onChange={e => set({ staffId: e.target.value.replace(/\D/g, '') })} className='w-28' />
            <Select value={String(state.direction || 'all')} onValueChange={v => v && set({ direction: v === 'all' ? '' : v })}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Both directions</SelectItem>
                <SelectItem value='deposit'>Deposit (down)</SelectItem>
                <SelectItem value='withdraw'>Withdraw (up)</SelectItem>
              </SelectContent>
            </Select>
            <DateInput value={String(state.from ?? '')} onChange={from => set({ from })} placeholder='From' />
            <DateInput value={String(state.to ?? '')} onChange={to => set({ to })} placeholder='To' />
          </>
        }
      />
    </div>
  )
}

export default Transfers
