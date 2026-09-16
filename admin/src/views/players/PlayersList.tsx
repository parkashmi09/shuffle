'use client'

import { useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { DownloadIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import FormDialog from '@/components/shared/FormDialog'
import { TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import type { PlayerRow } from './types'

const columns: Column<PlayerRow>[] = [
  {
    key: 'name',
    header: 'Player',
    cell: r => (
      <div className='flex flex-col'>
        <Link href={`/players/${r.id}`} className='font-medium hover:underline'>
          {r.name}
        </Link>
        <span className='text-muted-foreground font-mono text-xs'>{r.id}</span>
      </div>
    )
  },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'channel', header: 'Channel', cell: r => <Badge variant='outline'>{r.channel}{r.agentId ? ` · #${r.agentId}` : ''}</Badge> },
  { key: 'balance', header: 'Balance', align: 'right', cell: r => <Money value={r.balance} /> },
  { key: 'dep', header: 'Deposited', align: 'right', cell: r => <Money value={r.totalDeposited} /> },
  { key: 'wd', header: 'Withdrawn', align: 'right', cell: r => <Money value={r.totalWithdrawn} /> },
  { key: 'wager', header: 'Wagered', align: 'right', cell: r => <Money value={r.wager} /> },
  { key: 'vip', header: 'VIP', cell: r => <span className='text-sm'>L{r.vip?.level ?? 0} <span className='text-muted-foreground'>{r.vip?.card}</span></span> },
  { key: 'games', header: 'Games', align: 'right', cell: r => formatNumber(r.gamesPlayed) },
  { key: 'ref', header: 'Referral', cell: r => <span className='font-mono text-xs'>{r.referralCode}</span> }
]

const CreatePlayer = () => {
  const [form, setForm] = useState({ username: '', email: '', phone: '', country: '', password: '', initialBalance: '0' })
  const router = useRouter()

  const create = useApiMutation({
    fn: () => {
      const body: Record<string, string> = { username: form.username, password: form.password, initialBalance: form.initialBalance || '0' }

      if (form.email) body.email = form.email
      if (form.phone) body.phone = form.phone
      if (form.country) body.country = form.country

      return api.post<{ id: string | number }>('admin/players', body)
    },
    invalidate: [['paged', 'admin/reports/players']],
    success: 'Player created',
    onSuccess: r => r?.id && router.push(`/players/${r.id}`)
  })

  return (
    <FormDialog
      trigger={
        <Button>
          <PlusIcon /> New player
        </Button>
      }
      title='Create a player'
      description='An operator-created account. The player can change the password after first sign-in.'
      submitLabel='Create'
      onSubmit={() => create.mutateAsync()}
    >
      <TextField id='username' label='Username' required minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
      <TextField id='email' label='Email' type='email' value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='phone' label='Phone' value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <TextField id='country' label='Country' value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
      </div>
      <TextField id='password' label='Password' type='password' required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
      <TextField id='initialBalance' label='Initial balance' hint='Decimal string, e.g. 100.00' value={form.initialBalance} onChange={e => setForm({ ...form, initialBalance: e.target.value })} />
    </FormDialog>
  )
}

const PlayersList = () => {
  const { state, set, query } = useListState(['channel'], { channel: 'all' })
  const list = usePagedApi<PlayerRow>('admin/reports/players', { ...query, sort: undefined, order: undefined })
  const router = useRouter()

  const exportCsv = async () => {
    try {
      const blob = await api.blob('admin/reports/players/export', { channel: state.channel || 'all', search: state.search || undefined })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: 'players.csv' })

      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(String(e))
    }
  }

  return (
    <div>
      <PageHeader
        title='Players'
        description='Every player account, with balance, lifetime deposits and withdrawals, and VIP position.'
        actions={
          <>
            <Can permission='reports:read'>
              <Button variant='outline' onClick={exportCsv}>
                <DownloadIcon /> Export CSV
              </Button>
            </Can>
            <Can permission='users:write'>
              <CreatePlayer />
            </Can>
          </>
        }
      />
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
        search={String(state.search ?? '')}
        onSearchChange={search => set({ search })}
        searchPlaceholder='Username, email, id…'
        onRowClick={r => router.push(`/players/${r.id}`)}
        toolbar={
          <Select value={String(state.channel || 'all')} onValueChange={v => v && set({ channel: v })}>
            <SelectTrigger className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All channels</SelectItem>
              <SelectItem value='direct'>Direct</SelectItem>
              <SelectItem value='agent'>Via agent</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </div>
  )
}

export default PlayersList
