'use client'

import { useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { ChevronRightIcon, PlusIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import DataTable, { type Column } from '@/components/shared/DataTable'
import FormDialog from '@/components/shared/FormDialog'
import { SelectField, TextField } from '@/components/shared/FormField'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { ROLE_NAMES, STAFF_STATUSES, type StaffNode, type StaffRow } from './types'

const columns: Column<StaffRow>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: r => (
      <div className='flex flex-col'>
        <Link href={`/staff/${r.id}`} className='font-medium hover:underline'>
          {r.name}
        </Link>
        <span className='text-muted-foreground text-xs'>{r.email}</span>
      </div>
    )
  },
  { key: 'role', header: 'Role', cell: r => <Badge variant='secondary'>{ROLE_NAMES[r.roleId] ?? `role ${r.roleId}`}</Badge> },
  { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.status} /> },
  { key: 'pct', header: 'Share %', align: 'right', cell: r => <span className='tabular-nums'>{r.percentage}%</span> },
  { key: 'parent', header: 'Reports to', cell: r => (r.parentId ? <Link href={`/staff/${r.parentId}`} className='hover:underline'>#{r.parentId}</Link> : <span className='text-muted-foreground'>—</span>) },
  { key: 'country', header: 'Country', cell: r => r.country ?? '—' },
  { key: 'id', header: 'ID', cell: r => <span className='font-mono text-xs'>#{r.id}</span> }
]

const CreateStaff = () => {
  const { actor } = useSession()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', country: '', roleId: '6', percentage: '' })
  const router = useRouter()

  const create = useApiMutation({
    fn: () => {
      const body: Record<string, string | number> = { name: form.name, email: form.email, password: form.password, roleId: Number(form.roleId) }

      if (form.phone) body.phone = form.phone
      if (form.country) body.country = form.country
      if (form.percentage) body.percentage = form.percentage

      return api.post<{ id: number }>('admin/staff', body)
    },
    invalidate: [['paged', 'admin/staff'], ['api', 'admin/staff/tree']],
    success: 'Staff account created',
    onSuccess: r => r?.id && router.push(`/staff/${r.id}`)
  })

  // A staff member can only create accounts strictly below their own level.
  const roles = Object.entries(ROLE_NAMES).filter(([level]) => Number(level) > (actor?.level ?? 99))

  return (
    <FormDialog
      trigger={
        <Button>
          <PlusIcon /> New staff
        </Button>
      }
      title='Create a staff account'
      description='The new account reports to you. Password must be at least 12 characters; they will be asked to change it on first sign-in.'
      submitLabel='Create'
      onSubmit={() => create.mutateAsync()}
    >
      <TextField id='s-name' label='Name' required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <TextField id='s-email' label='Email' type='email' required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      <TextField id='s-password' label='Temporary password' type='password' required minLength={12} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <SelectField id='s-role' label='Role' value={form.roleId} onChange={roleId => setForm({ ...form, roleId })} options={roles.map(([v, l]) => ({ value: v, label: `${l} (level ${v})` }))} />
        <TextField id='s-pct' label='Share %' hint='0–100, up to 4 decimals' value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} />
      </div>
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='s-phone' label='Phone' value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <TextField id='s-country' label='Country' value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
      </div>
    </FormDialog>
  )
}

const TreeNode = ({ node, depth }: { node: StaffNode; depth: number }) => (
  <div>
    <div className='hover:bg-muted/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm' style={{ paddingLeft: depth * 20 + 8 }}>
      {node.children.length > 0 ? <ChevronRightIcon className='text-muted-foreground size-4 rotate-90' /> : <span className='size-4' />}
      <Link href={`/staff/${node.id}`} className='font-medium hover:underline'>
        {node.name}
      </Link>
      <Badge variant='secondary' className='font-normal'>
        {ROLE_NAMES[node.roleId] ?? node.roleId}
      </Badge>
      <StatusBadge value={node.status} />
      <span className='text-muted-foreground ml-auto tabular-nums'>{node.percentage}%</span>
    </div>
    {node.children.map(c => (
      <TreeNode key={c.id} node={c} depth={depth + 1} />
    ))}
  </div>
)

const StaffTree = () => {
  const tree = useApi<StaffNode[]>('admin/staff/tree')

  return (
    <Card className='shadow-none'>
      <CardHeader>
        <CardTitle className='text-base'>Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        {tree.isLoading && <Skeleton className='h-40' />}
        {tree.data?.map(n => (
          <TreeNode key={n.id} node={n} depth={0} />
        ))}
      </CardContent>
    </Card>
  )
}

const StaffList = () => {
  const { state, set, query } = useListState(['status'])
  const list = usePagedApi<StaffRow>('admin/staff', { limit: query.limit, page: query.page, search: query.search, status: query.status })

  return (
    <div>
      <PageHeader
        title='Staff & agents'
        description='The agent hierarchy: super masters, masters, agents and executives, each reporting up one level.'
        actions={
          <Can permission='staff:write'>
            <CreateStaff />
          </Can>
        }
      />
      <Tabs defaultValue='list'>
        <TabsList className='mb-4'>
          <TabsTrigger value='list'>List</TabsTrigger>
          <TabsTrigger value='tree'>Tree</TabsTrigger>
        </TabsList>
        <TabsContent value='list'>
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
            searchPlaceholder='Name or email…'
            toolbar={
              <Select value={String(state.status || 'all')} onValueChange={v => v && set({ status: v === 'all' ? '' : v })}>
                <SelectTrigger className='w-40'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Any status</SelectItem>
                  {STAFF_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </TabsContent>
        <TabsContent value='tree'>
          <StaffTree />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default StaffList
