'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { BanIcon, LockIcon, PencilIcon, WalletIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import FormDialog from '@/components/shared/FormDialog'
import { SelectField, SwitchField, TextAreaField, TextField } from '@/components/shared/FormField'
import JsonView from '@/components/shared/JsonView'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import type { PlayerRow } from './types'

type Report = PlayerRow & { wallets: Record<string, string>; createdAt: string; email?: string; phone?: string; country?: string }
type Ledger = Record<string, unknown> & { id: number | string; currency?: string; amount?: string; balanceAfter?: string; balance_after?: string; type?: string; kind?: string; description?: string; createdAt?: string; created_at?: string }
type Prefs = { email_notifications: boolean; push_notifications: boolean; theme: string; language: string; hide_balance: boolean }

const AdjustWallet = ({ userId, currencies }: { userId: string; currencies: string[] }) => {
  const [form, setForm] = useState({ currency: currencies[0] ?? 'INR', amount: '', operation: 'credit', description: '', transactionPassword: '' })
  const adjust = useApiMutation({
    fn: () => {
      const body: Record<string, string | number> = { userId: Number(userId), currency: form.currency, amount: form.amount, operation: form.operation, description: form.description }

      if (form.transactionPassword) body.transactionPassword = form.transactionPassword

      return api.post('admin/user/wallet/adjust', body)
    },
    invalidate: [['api', `admin/reports/players/${userId}`], ['paged', `admin/user/wallet/${userId}/history`], ['api', `admin/user/wallet/${userId}/balances`]],
    success: 'Balance adjusted'
  })

  return (
    <FormDialog
      trigger={
        <Button variant='outline'>
          <WalletIcon /> Adjust balance
        </Button>
      }
      title='Adjust wallet balance'
      description='Writes a ledger entry against the player. Credits add funds, debits remove them. A reason is required and audited.'
      submitLabel='Apply'
      onSubmit={() => adjust.mutateAsync()}
    >
      <div className='grid grid-cols-2 gap-4'>
        <SelectField id='a-op' label='Operation' value={form.operation} onChange={operation => setForm({ ...form, operation })} options={[{ value: 'credit', label: 'Credit (add)' }, { value: 'debit', label: 'Debit (remove)' }]} />
        <SelectField id='a-cur' label='Currency' value={form.currency} onChange={currency => setForm({ ...form, currency })} options={(currencies.length ? currencies : ['INR', 'USDT']).map(c => ({ value: c, label: c }))} />
      </div>
      <TextField id='a-amt' label='Amount' required placeholder='100.00' value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
      <TextAreaField id='a-desc' label='Reason' required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <TextField id='a-tp' label='Transaction password' type='password' hint='Required if your account has one set' value={form.transactionPassword} onChange={e => setForm({ ...form, transactionPassword: e.target.value })} />
    </FormDialog>
  )
}

const EditPlayer = ({ player }: { player: Report }) => {
  const [form, setForm] = useState({ username: player.name, email: player.email ?? '', phone: player.phone ?? '', country: player.country ?? '', password: '' })
  const update = useApiMutation({
    fn: () => {
      const body: Record<string, string> = {}

      if (form.username !== player.name) body.username = form.username
      if (form.email && form.email !== player.email) body.email = form.email
      if (form.phone && form.phone !== player.phone) body.phone = form.phone
      if (form.country && form.country !== player.country) body.country = form.country
      if (form.password) body.password = form.password

      return api.patch(`admin/players/${player.id}`, body)
    },
    invalidate: [['api', `admin/reports/players/${player.id}`]],
    success: 'Player updated'
  })

  return (
    <FormDialog
      trigger={
        <Button variant='outline'>
          <PencilIcon /> Edit
        </Button>
      }
      title='Edit player'
      onSubmit={() => update.mutateAsync()}
    >
      <TextField id='e-user' label='Username' minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
      <TextField id='e-email' label='Email' type='email' value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='e-phone' label='Phone' value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <TextField id='e-country' label='Country' value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
      </div>
      <TextField id='e-pw' label='New password' type='password' hint='Leave blank to keep' value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
    </FormDialog>
  )
}

const Locks = ({ userId }: { userId: string }) => {
  const [locks, setLocks] = useState({ system: false, casino: false, sports: false })
  const apply = useApiMutation({
    fn: () => api.post('admin/locks', { userId: Number(userId), ...locks }),
    success: 'Locks updated'
  })

  return (
    <FormDialog
      trigger={
        <Button variant='outline'>
          <LockIcon /> Locks
        </Button>
      }
      title='Player locks'
      description='Turning a lock on blocks that product for this player immediately. The platform does not report current lock state on this screen; set all three deliberately.'
      submitLabel='Apply locks'
      onSubmit={() => apply.mutateAsync()}
    >
      <SwitchField id='l-system' label='System lock' hint='Blocks sign-in and everything else' checked={locks.system} onChange={system => setLocks({ ...locks, system })} />
      <SwitchField id='l-casino' label='Casino lock' checked={locks.casino} onChange={casino => setLocks({ ...locks, casino })} />
      <SwitchField id='l-sports' label='Sports lock' checked={locks.sports} onChange={sports => setLocks({ ...locks, sports })} />
    </FormDialog>
  )
}

const ledgerColumns: Column<Ledger>[] = [
  { key: 'at', header: 'When', cell: r => <DateTime value={r.createdAt ?? r.created_at} /> },
  { key: 'type', header: 'Type', cell: r => <StatusBadge value={String(r.type ?? r.kind ?? '')} /> },
  { key: 'amount', header: 'Amount', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} signed /> },
  { key: 'after', header: 'Balance after', align: 'right', cell: r => <Money value={r.balanceAfter ?? r.balance_after} currency={r.currency} /> },
  { key: 'desc', header: 'Description', cell: r => <span className='text-muted-foreground text-sm'>{String(r.description ?? '')}</span> }
]

const WalletTab = ({ userId }: { userId: string }) => {
  const { state, set, query } = useListState()
  const history = usePagedApi<Ledger>(`admin/user/wallet/${userId}/history`, { limit: query.limit, page: query.page })

  return <DataTable columns={ledgerColumns} rows={history.data?.rows} rowKey={r => String(r.id)} loading={history.isLoading} error={history.error} pagination={history.data?.pagination} onPageChange={page => set({ page })} onLimitChange={limit => set({ limit })} dense emptyMessage={`No ledger entries yet (page ${state.page}).`} />
}

const PrefsTab = ({ userId }: { userId: string }) => {
  const q = useApi<Prefs>(`admin/site-config/user/${userId}`)
  const save = useApiMutation({
    fn: (patch: Partial<Prefs>) => api.put(`admin/site-config/user/${userId}`, patch),
    invalidate: [['api', `admin/site-config/user/${userId}`]],
    success: 'Preference saved'
  })

  if (q.error) return <ErrorState error={q.error} />
  const p = q.data

  return (
    <Card className='max-w-xl shadow-none'>
      <CardContent className='grid gap-2 pt-6'>
        <SwitchField id='p-email' label='Email notifications' checked={!!p?.email_notifications} onChange={v => save.mutate({ email_notifications: v })} disabled={!p} />
        <SwitchField id='p-push' label='Push notifications' checked={!!p?.push_notifications} onChange={v => save.mutate({ push_notifications: v })} disabled={!p} />
        <SwitchField id='p-hide' label='Hide balance' checked={!!p?.hide_balance} onChange={v => save.mutate({ hide_balance: v })} disabled={!p} />
        <div className='text-muted-foreground mt-2 text-sm'>Theme: {p?.theme ?? '—'} · Language: {p?.language ?? '—'}</div>
      </CardContent>
    </Card>
  )
}

const RawTab = ({ path }: { path: string }) => {
  const q = useApi<unknown>(path)

  if (q.error) return <ErrorState error={q.error} />

  return <JsonView value={q.data ?? 'loading…'} />
}

const PlayerDetail = ({ id }: { id: string }) => {
  const router = useRouter()
  const report = useApi<Report>(`admin/reports/players/${id}`)
  const close = useApiMutation({
    fn: (reason: string) => api.delete(`admin/players/${id}`, { reason }),
    invalidate: [['paged', 'admin/reports/players']],
    success: 'Account closed',
    onSuccess: () => router.push('/players')
  })
  const [reason, setReason] = useState('')
  const p = report.data
  const currencies = Object.keys(p?.wallets ?? {})

  return (
    <div>
      <PageHeader
        title={p?.name ?? `Player ${id}`}
        description={
          p ? (
            <span className='flex flex-wrap items-center gap-2'>
              <span className='font-mono'>#{p.id}</span>
              <StatusBadge value={p.status} />
              <Badge variant='outline'>{p.channel}{p.agentId ? ` · agent #${p.agentId}` : ''}</Badge>
              <span>VIP L{p.vip?.level} · {p.vip?.card}</span>
              <span>joined <DateTime value={p.createdAt} relative /></span>
            </span>
          ) : undefined
        }
        actions={
          p && (
            <>
              <Can permission='wallet:adjust'>
                <AdjustWallet userId={id} currencies={currencies} />
              </Can>
              <Can permission='users:write'>
                <Locks userId={id} />
                <EditPlayer player={p} />
                <ConfirmDialog
                  trigger={
                    <Button variant='destructive'>
                      <BanIcon /> Close account
                    </Button>
                  }
                  title='Close this account?'
                  description='The player will no longer be able to sign in. Funds stay on the ledger.'
                  confirmLabel='Close account'
                  destructive
                  onConfirm={() => close.mutateAsync(reason)}
                >
                  <TextAreaField id='close-reason' label='Reason' required minLength={3} value={reason} onChange={e => setReason(e.target.value)} />
                </ConfirmDialog>
              </Can>
            </>
          )
        }
      />
      {report.error && <ErrorState error={report.error} />}

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard label='Balance' value={<Money value={p?.balance} />} loading={report.isLoading} hint={currencies.map(c => `${c} ${p?.wallets[c]}`).join(' · ')} />
        <StatCard label='Deposited' value={<Money value={p?.totalDeposited} />} loading={report.isLoading} />
        <StatCard label='Withdrawn' value={<Money value={p?.totalWithdrawn} />} loading={report.isLoading} />
        <StatCard label='Wagered' value={<Money value={p?.wager} />} loading={report.isLoading} hint={`${formatNumber(p?.gamesPlayed)} games · ref ${p?.referralCode ?? ''}`} />
      </div>

      <Tabs defaultValue='wallet' className='mt-6'>
        <TabsList className='mb-4 flex-wrap'>
          <TabsTrigger value='wallet'>Ledger</TabsTrigger>
          <TabsTrigger value='balances'>Balances</TabsTrigger>
          <TabsTrigger value='prefs'>Preferences</TabsTrigger>
          <TabsTrigger value='risk'>Risk</TabsTrigger>
          <TabsTrigger value='sheet'>Balance sheet</TabsTrigger>
          <TabsTrigger value='transfers'>Transfers</TabsTrigger>
          <TabsTrigger value='notifications'>Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value='wallet'>
          <WalletTab userId={id} />
        </TabsContent>
        <TabsContent value='balances'>
          <RawTab path={`admin/user/wallet/${id}/balances`} />
        </TabsContent>
        <TabsContent value='prefs'>
          <PrefsTab userId={id} />
        </TabsContent>
        <TabsContent value='risk'>
          <RawTab path={`admin/reports/user-risk/${id}`} />
        </TabsContent>
        <TabsContent value='sheet'>
          <RawTab path={`admin/reports/balance-sheet/${id}`} />
        </TabsContent>
        <TabsContent value='transfers'>
          <RawTab path={`admin/locks/transfers/${id}`} />
        </TabsContent>
        <TabsContent value='notifications'>
          <RawTab path={`admin/notifications/history/${id}`} />
        </TabsContent>
      </Tabs>
      <Card className='mt-6 shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>Raw report</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonView value={p} />
        </CardContent>
      </Card>
    </div>
  )
}

export default PlayerDetail
