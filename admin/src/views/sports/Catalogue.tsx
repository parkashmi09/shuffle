'use client'

import { useState } from 'react'

import { PlusIcon, Trash2Icon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import FormDialog from '@/components/shared/FormDialog'
import { SwitchField, TextField } from '@/components/shared/FormField'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import type { FancyControl, SportRow } from './types'

/**
 * Which sports the book offers, and which fancy markets are hidden.
 * A newly added sport is OFF until somebody turns it on — the safe direction.
 */
const Sports = () => {
  const [enabledOnly, setEnabledOnly] = useState(false)
  const list = useApi<SportRow[]>('admin/sports/catalogue/sports', { enabledOnly: enabledOnly || undefined }, { retry: false })
  const [form, setForm] = useState({ gameId: '', gameName: '', enabled: false })

  const add = useApiMutation({
    fn: () => api.post('admin/sports/catalogue/sports', { gameId: Number(form.gameId), gameName: form.gameName, enabled: form.enabled }),
    invalidate: [['api', 'admin/sports/catalogue/sports']],
    success: 'Sport added',
    onSuccess: () => setForm({ gameId: '', gameName: '', enabled: false })
  })
  const update = useApiMutation({
    fn: (v: { id: number; enabled: boolean }) => api.put(`admin/sports/catalogue/sports/${v.id}`, { enabled: v.enabled }),
    invalidate: [['api', 'admin/sports/catalogue/sports']],
    success: (_r, v) => `Sport ${v.enabled ? 'enabled' : 'disabled'}`
  })
  const remove = useApiMutation({
    fn: (id: number) => api.delete(`admin/sports/catalogue/sports/${id}`),
    invalidate: [['api', 'admin/sports/catalogue/sports']],
    success: 'Sport removed'
  })

  const columns: Column<SportRow>[] = [
    { key: 'name', header: 'Sport', cell: s => <span className='font-medium'>{s.gameName}</span> },
    { key: 'gameId', header: 'Provider id', cell: s => <span className='font-mono text-xs'>{s.gameId}</span> },
    {
      key: 'enabled',
      header: 'Offered',
      cell: s => (
        <Can permission='sports:manage' fallback={<StatusBadge value={s.enabled} />}>
          <Switch checked={s.enabled} onCheckedChange={enabled => update.mutate({ id: s.id, enabled })} />
        </Can>
      )
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: s => (
        <Can permission='sports:manage'>
          <ConfirmDialog
            trigger={
              <Button variant='ghost' size='icon-sm' aria-label='Remove'>
                <Trash2Icon />
              </Button>
            }
            title={`Remove ${s.gameName}?`}
            description='The sport stops being offered. Bets already placed on it are untouched.'
            confirmLabel='Remove'
            destructive
            onConfirm={() => remove.mutateAsync(s.id)}
          />
        </Can>
      )
    }
  ]

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <Switch checked={enabledOnly} onCheckedChange={setEnabledOnly} /> Offered only
        </label>
        <Can permission='sports:manage'>
          <FormDialog
            trigger={
              <Button>
                <PlusIcon /> Add sport
              </Button>
            }
            title='Add a sport'
            description='The provider id is the feed’s own id for this sport. It starts switched off.'
            submitLabel='Add'
            onSubmit={() => add.mutateAsync()}
          >
            <TextField id='sp-id' label='Provider game id' required inputMode='numeric' value={form.gameId} onChange={e => setForm({ ...form, gameId: e.target.value.replace(/\D/g, '') })} />
            <TextField id='sp-name' label='Name' required value={form.gameName} onChange={e => setForm({ ...form, gameName: e.target.value })} />
            <SwitchField id='sp-on' label='Offer immediately' checked={form.enabled} onChange={enabled => setForm({ ...form, enabled })} />
          </FormDialog>
        </Can>
      </div>
      <DataTable columns={columns} rows={list.data} rowKey={s => s.id} loading={list.isLoading} error={list.error} emptyMessage='No sport configured. The book offers nothing until one is added and enabled.' />
    </div>
  )
}

const Fancy = () => {
  const { state, set, query } = useListState(['eventId'])
  const [hiddenOnly, setHiddenOnly] = useState(false)
  const list = usePagedApi<FancyControl>('admin/sports/catalogue/fancy', {
    limit: query.limit,
    page: query.page,
    eventId: query.eventId || undefined,
    hiddenOnly: hiddenOnly || undefined
  })
  const setStatus = useApiMutation({
    fn: (v: FancyControl) => api.post('admin/sports/catalogue/fancy', { eventId: v.eventId, marketId: v.marketId, showFancy: v.showFancy, ...(v.eventName ? { eventName: v.eventName } : {}), ...(v.marketName ? { marketName: v.marketName } : {}) }),
    invalidate: [['paged', 'admin/sports/catalogue/fancy']],
    success: (_r, v) => `Market ${v.showFancy ? 'shown' : 'hidden'}`
  })
  const remove = useApiMutation({
    fn: (marketId: string) => api.delete(`admin/sports/catalogue/fancy/${marketId}`),
    invalidate: [['paged', 'admin/sports/catalogue/fancy']],
    success: 'Control removed — the market follows the feed again'
  })

  const columns: Column<FancyControl>[] = [
    {
      key: 'market',
      header: 'Market',
      cell: f => (
        <span className='block max-w-96'>
          <span className='block truncate text-sm'>{f.marketName ?? f.marketId}</span>
          <span className='text-muted-foreground block truncate font-mono text-xs'>{f.marketId}</span>
        </span>
      )
    },
    { key: 'event', header: 'Event', cell: f => <span className='block max-w-64 truncate text-sm'>{f.eventName ?? f.eventId}</span> },
    {
      key: 'show',
      header: 'Shown to players',
      cell: f => (
        <Can permission='sports:manage' fallback={<StatusBadge value={f.showFancy} />}>
          <Switch checked={f.showFancy} onCheckedChange={showFancy => setStatus.mutate({ ...f, showFancy })} />
        </Can>
      )
    },
    { key: 'at', header: 'Updated', cell: f => <DateTime value={f.updatedAt} relative /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: f => (
        <Can permission='sports:manage'>
          <ConfirmDialog
            trigger={
              <Button variant='ghost' size='icon-sm' aria-label='Remove control'>
                <Trash2Icon />
              </Button>
            }
            title='Remove this control?'
            description='The market goes back to whatever the feed says about it.'
            confirmLabel='Remove'
            destructive
            onConfirm={() => remove.mutateAsync(f.marketId)}
          />
        </Can>
      )
    }
  ]

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={(f, i) => `${f.marketId}-${i}`}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
      emptyMessage='No fancy market has been overridden. Every one follows the feed.'
      toolbar={
        <>
          <Input placeholder='Event id' className='w-40' value={String(state.eventId ?? '')} onChange={e => set({ eventId: e.target.value })} />
          <label className='flex items-center gap-2 text-sm'>
            <Switch checked={hiddenOnly} onCheckedChange={setHiddenOnly} /> Hidden only
          </label>
        </>
      }
    />
  )
}

const Locks = () => {
  const { set, query } = useListState()
  const users = usePagedApi<Record<string, unknown> & { userId?: number; username?: string; locked?: boolean }>('admin/sports/bet-admin/locks/users', {
    limit: query.limit,
    page: query.page,
    lockedOnly: true
  })
  const setLock = useApiMutation({
    fn: (v: { userId: number; locked: boolean }) => api.post('admin/sports/bet-admin/locks/users', v),
    invalidate: [['paged', 'admin/sports/bet-admin/locks/users']],
    success: (_r, v) => `Player ${v.locked ? 'locked out of' : 'allowed back into'} the sportsbook`
  })
  const [userId, setUserId] = useState('')

  const columns: Column<{ userId?: number; username?: string; locked?: boolean }>[] = [
    { key: 'user', header: 'Player', cell: u => <span>{u.username ?? `#${u.userId}`}</span> },
    { key: 'locked', header: 'Sports locked', cell: u => <StatusBadge value={u.locked ? 'locked' : 'active'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: u => (
        <Can permission='sports:manage'>
          <Button size='sm' variant='outline' onClick={() => u.userId && setLock.mutate({ userId: u.userId, locked: !u.locked })}>
            {u.locked ? 'Unlock' : 'Lock'}
          </Button>
        </Can>
      )
    }
  ]

  return (
    <div className='grid gap-4'>
      <Can permission='sports:manage'>
        <div className='flex flex-wrap items-end gap-2'>
          <TextField id='lk-uid' label='Player id' value={userId} onChange={e => setUserId(e.target.value.replace(/\D/g, ''))} />
          <Button variant='outline' disabled={!/^\d+$/.test(userId)} onClick={() => setLock.mutate({ userId: Number(userId), locked: true })}>
            Lock
          </Button>
          <Button variant='outline' disabled={!/^\d+$/.test(userId)} onClick={() => setLock.mutate({ userId: Number(userId), locked: false })}>
            Unlock
          </Button>
        </div>
      </Can>
      <DataTable
        columns={columns}
        rows={users.data?.rows}
        rowKey={(u, i) => String(u.userId ?? i)}
        loading={users.isLoading}
        error={users.error}
        pagination={users.data?.pagination}
        onPageChange={page => set({ page })}
        onLimitChange={limit => set({ limit })}
        dense
        emptyMessage='No player is locked out of the sportsbook.'
      />
    </div>
  )
}

const Catalogue = () => (
  <div>
    <PageHeader title='Sports catalogue & locks' description='Which sports the book offers, which fancy markets are hidden, and who is locked out of betting.' />
    <Tabs defaultValue='sports'>
      <TabsList className='mb-4'>
        <TabsTrigger value='sports'>Sports</TabsTrigger>
        <TabsTrigger value='fancy'>Fancy controls</TabsTrigger>
        <TabsTrigger value='locks'>Locked players</TabsTrigger>
      </TabsList>
      <TabsContent value='sports'>
        <Sports />
      </TabsContent>
      <TabsContent value='fancy'>
        <Fancy />
      </TabsContent>
      <TabsContent value='locks'>
        <Locks />
      </TabsContent>
    </Tabs>
  </div>
)

export default Catalogue
