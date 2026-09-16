'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import { useListState, usePagedApi } from '@/hooks/use-api'
import { AdjustWalletDialog, stop } from './shared'
import type { WalletBalanceRow } from './types'

const LIST = 'admin/user/wallet/balances'
const PRIMARY = ['INR', 'USDT']

/** Every non-zero balance except the two shown as their own columns. */
const others = (b: Record<string, string>) =>
  Object.entries(b)
    .filter(([c, v]) => !PRIMARY.includes(c) && Number(v) !== 0)
    .map(([c, v]) => `${c} ${v}`)

const held = (b: Record<string, string>) => Object.entries(b).filter(([, v]) => Number(v) !== 0).map(([c]) => c)

const columns: Column<WalletBalanceRow>[] = [
  {
    key: 'name',
    header: 'Player',
    cell: r => (
      <div className='flex flex-col'>
        <Link href={`/players/${r.uid}`} className='font-medium hover:underline'>
          {r.name}
        </Link>
        <span className='text-muted-foreground font-mono text-xs'>{r.uid}</span>
      </div>
    )
  },
  { key: 'inr', header: 'INR', align: 'right', cell: r => <Money value={r.balances.INR} /> },
  { key: 'usdt', header: 'USDT', align: 'right', cell: r => <Money value={r.balances.USDT} /> },
  {
    key: 'other',
    header: 'Other holdings',
    cell: r => {
      const o = others(r.balances)

      return o.length ? <span className='font-mono text-xs'>{o.join(' · ')}</span> : <span className='text-muted-foreground text-xs'>—</span>
    }
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: r => (
      <div onClick={stop}>
        <Can permission={['wallet:credit', 'wallet:debit']}>
          <AdjustWalletDialog userId={r.uid} userName={r.name} currencies={Array.from(new Set([...PRIMARY, ...held(r.balances)]))} />
        </Can>
      </div>
    )
  }
]

const Wallets = () => {
  const { state, set, query } = useListState()
  const list = usePagedApi<WalletBalanceRow>(LIST, { limit: query.limit, page: query.page, search: query.search })
  const router = useRouter()

  return (
    <div>
      <PageHeader title='Wallets' description='Every player the platform lets you see, with their balances. Open a row for the ledger; adjust writes an audited entry.' />
      <DataTable
        columns={columns}
        rows={list.data?.rows}
        rowKey={r => r.uid}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.error}
        pagination={list.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        search={String(state.search ?? '')}
        onSearchChange={search => set({ search })}
        searchPlaceholder='Username or id…'
        onRowClick={r => router.push(`/players/${r.uid}`)}
      />
    </div>
  )
}

export default Wallets
