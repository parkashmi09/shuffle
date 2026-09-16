'use client'

import { useState } from 'react'

import { MegaphoneIcon, SendIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import { SelectField, TextAreaField, TextField } from '@/components/shared/FormField'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { NOTIFICATION_TYPES, type Device, type NotificationRow } from './types'

const TYPE_OPTIONS = NOTIFICATION_TYPES.map(t => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))

const Compose = () => {
  const [mode, setMode] = useState<'broadcast' | 'user'>('broadcast')
  const [form, setForm] = useState({ userId: '', title: '', body: '', type: 'general' })

  const send = useApiMutation({
    fn: () => {
      const message: Record<string, string> = { title: form.title, type: form.type }

      if (form.body) message.body = form.body

      return mode === 'broadcast'
        ? api.post<{ sent?: number; devices?: number }>('admin/notifications/broadcast', message)
        : api.post<{ sent?: number; devices?: number }>('admin/notifications/send', { userId: Number(form.userId), ...message })
    },
    success: r => `Queued — ${r?.sent ?? r?.devices ?? 0} device(s)`,
    onSuccess: () => setForm({ ...form, title: '', body: '' })
  })

  const ready = form.title.trim().length > 0 && (mode === 'broadcast' || /^\d+$/.test(form.userId))

  return (
    <Card className='max-w-2xl shadow-none'>
      <CardHeader>
        <CardTitle className='text-base'>Send a push notification</CardTitle>
        <CardDescription>
          Goes to every registered device for the audience you pick. A broadcast is capped by the platform so a mistake is refused rather than delivered.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <Tabs value={mode} onValueChange={v => setMode(v as 'broadcast' | 'user')}>
          <TabsList>
            <TabsTrigger value='broadcast'>Everyone</TabsTrigger>
            <TabsTrigger value='user'>One player</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'user' && (
          <TextField id='n-uid' label='Player id' required inputMode='numeric' value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value.replace(/\D/g, '') })} />
        )}
        <TextField id='n-title' label='Title' required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <TextAreaField id='n-body' label='Body' rows={3} maxLength={1000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
        <SelectField id='n-type' label='Type' value={form.type} onChange={type => setForm({ ...form, type })} options={TYPE_OPTIONS} />
        <Can permission='config:write'>
          <ConfirmDialog
            trigger={
              <Button disabled={!ready} className='justify-self-start'>
                {mode === 'broadcast' ? <MegaphoneIcon /> : <SendIcon />}
                {mode === 'broadcast' ? 'Broadcast' : 'Send'}
              </Button>
            }
            title={mode === 'broadcast' ? 'Send to every device?' : `Send to player ${form.userId}?`}
            description={`“${form.title}” — a push cannot be recalled once it is delivered.`}
            confirmLabel='Send'
            onConfirm={() => send.mutateAsync()}
          />
        </Can>
      </CardContent>
    </Card>
  )
}

const Devices = () => {
  const { state, set, query } = useListState(['userId'])
  const [activeOnly, setActiveOnly] = useState(true)
  const list = usePagedApi<Device>('admin/notifications/devices', {
    limit: query.limit,
    page: query.page,
    activeOnly,
    userId: query.userId || undefined
  })

  const columns: Column<Device>[] = [
    { key: 'user', header: 'Player', cell: d => <span>{d.name ?? `#${d.userId}`}<span className='text-muted-foreground block text-xs'>{d.email ?? d.userId}</span></span> },
    { key: 'platform', header: 'Platform', cell: d => <Badge variant='outline'>{d.platform ?? 'unknown'}</Badge> },
    { key: 'active', header: 'Status', cell: d => <StatusBadge value={d.active ? 'active' : 'inactive'} /> },
    { key: 'token', header: 'Token', cell: d => <span className='text-muted-foreground font-mono text-xs'>{d.token?.slice(0, 16)}…</span> },
    { key: 'at', header: 'Registered', cell: d => <DateTime value={d.registeredAt} relative /> }
  ]

  return (
    <DataTable
      columns={columns}
      rows={list.data?.rows}
      rowKey={d => d.id}
      loading={list.isLoading}
      fetching={list.isFetching}
      error={list.error}
      pagination={list.data?.pagination}
      onPageChange={page => set({ page })}
      onLimitChange={limit => set({ limit })}
      dense
      emptyMessage='No device has registered for push yet.'
      toolbar={
        <>
          <Input placeholder='Player id' className='w-32' value={String(state.userId ?? '')} onChange={e => set({ userId: e.target.value.replace(/\D/g, '') })} />
          <label className='flex items-center gap-2 text-sm'>
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} /> Active only
          </label>
        </>
      }
    />
  )
}

const History = () => {
  const [userId, setUserId] = useState('')
  const { set, query } = useListState()
  const list = usePagedApi<NotificationRow>(/^\d+$/.test(userId) ? `admin/notifications/history/${userId}` : null, { limit: query.limit, page: query.page })

  const columns: Column<NotificationRow>[] = [
    { key: 'title', header: 'Notification', cell: n => <span className='block max-w-96'><span className='block truncate font-medium'>{n.title}</span><span className='text-muted-foreground block truncate text-xs'>{n.body ?? ''}</span></span> },
    { key: 'type', header: 'Type', cell: n => <Badge variant='outline'>{n.type}</Badge> },
    { key: 'read', header: 'Read', cell: n => <StatusBadge value={n.read ? 'completed' : 'pending'} /> },
    { key: 'at', header: 'Sent', cell: n => <DateTime value={n.createdAt} relative /> }
  ]

  return (
    <div className='grid gap-4'>
      <div className='flex items-center gap-2'>
        <Input placeholder='Player id' className='w-48' value={userId} onChange={e => setUserId(e.target.value.replace(/\D/g, ''))} />
        <span className='text-muted-foreground text-sm'>Enter a player id to see everything sent to them.</span>
      </div>
      {/^\d+$/.test(userId) && (
        <DataTable
          columns={columns}
          rows={list.data?.rows}
          rowKey={n => n.id}
          loading={list.isLoading}
          error={list.error}
          pagination={list.data?.pagination}
          onPageChange={page => set({ page })}
          onLimitChange={limit => set({ limit })}
          dense
        />
      )}
    </div>
  )
}

const Notifications = () => (
  <div>
    <PageHeader title='Notifications' description='Push messages to players’ devices, the devices registered for them, and what a given player has already been sent.' />
    <Tabs defaultValue='compose'>
      <TabsList className='mb-4'>
        <TabsTrigger value='compose'>Compose</TabsTrigger>
        <TabsTrigger value='devices'>Devices</TabsTrigger>
        <TabsTrigger value='history'>Player history</TabsTrigger>
      </TabsList>
      <TabsContent value='compose'>
        <Compose />
      </TabsContent>
      <TabsContent value='devices'>
        <Devices />
      </TabsContent>
      <TabsContent value='history'>
        <History />
      </TabsContent>
    </Tabs>
  </div>
)

export default Notifications
