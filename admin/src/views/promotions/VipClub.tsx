'use client'

import { useState } from 'react'

import Link from 'next/link'

import { PencilIcon, PercentIcon, Trash2Icon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import DateTime from '@/components/shared/DateTime'
import ErrorState from '@/components/shared/ErrorState'
import FormDialog from '@/components/shared/FormDialog'
import { SwitchField, TextAreaField, TextField } from '@/components/shared/FormField'
import Money from '@/components/shared/Money'
import PageHeader from '@/components/shared/PageHeader'
import StatCard from '@/components/shared/StatCard'
import StatusBadge from '@/components/shared/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApi, useApiMutation, useListState, usePagedApi } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatMoney, formatNumber } from '@/lib/format'
import type { Club, ClubEarning, ClubMember, VipLevel } from './types'
import { useLocalList } from './useLocalList'

const CARD_TONE: Record<string, string> = {
  brownz: 'bg-amber-800/15 text-amber-900 dark:text-amber-300',
  bronze: 'bg-amber-800/15 text-amber-900 dark:text-amber-300',
  silver: 'bg-slate-400/20 text-slate-700 dark:text-slate-200',
  gold: 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300',
  platinum: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300',
  diamond: 'bg-violet-500/15 text-violet-800 dark:text-violet-300'
}

// ── VIP ladder (read-only; no staff route exists) ─────────────────────

const VipLadder = () => {
  const q = useApi<VipLevel[]>('user/vip/levels')
  const levels = q.data ?? []
  const tiers = Array.from(new Set(levels.map(l => l.card)))

  const columns: Column<VipLevel>[] = [
    { key: 'level', header: 'Level', cell: r => <span className='font-semibold tabular-nums'>L{r.level}</span> },
    { key: 'card', header: 'Card', cell: r => <Badge variant='outline' className={`border-transparent capitalize ${CARD_TONE[r.card] ?? ''}`}>{r.card}</Badge> },
    { key: 'min', header: 'From (XP / wagered)', align: 'right', cell: r => <Money value={r.minXp} /> },
    { key: 'max', header: 'To', align: 'right', cell: r => <Money value={r.maxXp} /> }
  ]

  return (
    <div className='grid gap-4'>
      <p className='text-muted-foreground text-sm'>
        The ladder the site shows players, read from the public <code>user/vip/levels</code> route. Thresholds are wagering totals. The platform has no staff route to change them; the daily / weekly / monthly bonus thresholds (VIP 20 / 25 / 30) live on the <Link href='/bonus' className='underline'>Bonus</Link> screen.
      </p>
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatCard label='Levels' value={formatNumber(levels.length)} loading={q.isLoading} />
        <StatCard label='Tiers' value={formatNumber(tiers.length)} hint={tiers.join(' · ')} loading={q.isLoading} />
        <StatCard label='Top level from' value={formatMoney(levels[levels.length - 1]?.minXp)} loading={q.isLoading} />
      </div>
      <div className='flex flex-wrap gap-2'>
        {tiers.map(t => {
          const of = levels.filter(l => l.card === t)

          return (
            <Badge key={t} variant='outline' className={`border-transparent capitalize ${CARD_TONE[t] ?? ''}`}>
              {t}: L{of[0]?.level}–L{of[of.length - 1]?.level}
            </Badge>
          )
        })}
      </div>
      <DataTable columns={columns} rows={q.data} rowKey={r => r.level} loading={q.isLoading} error={q.error} dense />
    </div>
  )
}

// ── Clubs ─────────────────────────────────────────────────────────────

const CLUB_INVALIDATE = [['paged', 'admin/user/clubs'], ['api', 'admin/user/clubs']]

const ClubDetail = ({ club, onClose }: { club: Club; onClose: () => void }) => {
  const members = useLocalList()
  const earnings = useLocalList()
  const [role, setRole] = useState('all')
  const detail = useApi<Club>(`admin/user/clubs/${club.id}`)
  const memberList = usePagedApi<ClubMember>(`admin/user/clubs/${club.id}/members`, { limit: members.limit, page: members.page, role: role === 'all' ? undefined : role })
  const earningList = usePagedApi<ClubEarning>(`admin/user/clubs/${club.id}/earnings`, { limit: earnings.limit, page: earnings.page })
  const c = detail.data ?? club

  const [edit, setEdit] = useState({ name: '', description: '', maxMembers: '', isActive: true })
  const [cfg, setCfg] = useState({ ownerPercentage: '', agentPercentage: '', memberPercentage: '', activePlayerThreshold: '', wagerThreshold: '' })

  const update = useApiMutation({
    fn: () => {
      const body: Record<string, string | number | boolean> = {}

      if (edit.name && edit.name !== c.name) body.name = edit.name
      if (edit.description !== (c.description ?? '')) body.description = edit.description
      if (edit.maxMembers && Number(edit.maxMembers) !== c.maxMembers) body.maxMembers = Number(edit.maxMembers)
      if (edit.isActive !== c.isActive) body.isActive = edit.isActive

      return api.put(`admin/user/clubs/${club.id}`, body)
    },
    invalidate: [...CLUB_INVALIDATE, ['api', `admin/user/clubs/${club.id}`]],
    success: 'Club updated'
  })
  const setConfig = useApiMutation({
    fn: () => {
      const body: Record<string, string | number> = {}

      if (cfg.ownerPercentage) body.ownerPercentage = cfg.ownerPercentage
      if (cfg.agentPercentage) body.agentPercentage = cfg.agentPercentage
      if (cfg.memberPercentage) body.memberPercentage = cfg.memberPercentage
      if (cfg.activePlayerThreshold) body.activePlayerThreshold = Number(cfg.activePlayerThreshold)
      if (cfg.wagerThreshold) body.wagerThreshold = cfg.wagerThreshold

      return api.put(`admin/user/clubs/${club.id}/earnings-config`, body)
    },
    invalidate: [...CLUB_INVALIDATE, ['api', `admin/user/clubs/${club.id}`]],
    success: 'Earnings split saved'
  })
  const remove = useApiMutation({
    fn: () => api.delete(`admin/user/clubs/${club.id}`),
    invalidate: CLUB_INVALIDATE,
    success: 'Club deleted',
    onSuccess: onClose
  })

  const memberColumns: Column<ClubMember>[] = [
    {
      key: 'user',
      header: 'Player',
      cell: r => (
        <div className='flex flex-col'>
          <Link href={`/players/${r.userId}`} className='font-medium hover:underline'>{r.user?.name ?? `#${r.userId}`}</Link>
          <span className='text-muted-foreground font-mono text-xs'>#{String(r.userId)}{r.user?.level != null ? ` · L${r.user.level}` : ''}</span>
        </div>
      )
    },
    { key: 'role', header: 'Role', cell: r => <StatusBadge value={r.role} /> },
    { key: 'agent', header: 'Agent code', cell: r => <span className='font-mono text-xs'>{r.agentCode ?? '—'}</span> },
    { key: 'parent', header: 'Under agent', cell: r => (r.agentId ? <span className='font-mono text-xs'>#{r.agentId}</span> : '—') },
    { key: 'joined', header: 'Joined', cell: r => <DateTime value={r.joinedAt} /> }
  ]
  const earningColumns: Column<ClubEarning>[] = [
    { key: 'at', header: 'When', cell: r => <DateTime value={r.createdAt} /> },
    { key: 'who', header: 'Beneficiary', cell: r => <span className='font-mono text-xs'>#{String(r.beneficiaryId)}</span> },
    { key: 'role', header: 'Role', cell: r => <StatusBadge value={r.role} /> },
    { key: 'wager', header: 'Wager', align: 'right', cell: r => <Money value={r.wager} /> },
    { key: 'pct', header: '%', align: 'right', cell: r => `${r.percentage}%` },
    { key: 'amount', header: 'Earned', align: 'right', cell: r => <Money value={r.amount} currency={r.currency} /> },
    { key: 'paid', header: 'Paid', cell: r => <StatusBadge value={r.paid ? 'completed' : 'pending'} /> }
  ]

  return (
    <Card className='shadow-none'>
      <CardHeader>
        <CardTitle className='flex flex-wrap items-center gap-2 text-base'>
          {c.name}
          <Badge variant='secondary' className='font-mono font-normal'>{c.code}</Badge>
          <StatusBadge value={c.isActive ? 'active' : 'inactive'} />
          <span className='grow' />
          <Can permission='config:write'>
            <FormDialog
              trigger={<Button variant='outline' size='sm'><PencilIcon /> Edit</Button>}
              title='Edit club'
              onSubmit={() => update.mutateAsync()}
              onOpenChange={o => o && setEdit({ name: c.name, description: c.description ?? '', maxMembers: c.maxMembers ? String(c.maxMembers) : '', isActive: c.isActive })}
            >
              <TextField id='cl-name' label='Name' minLength={2} maxLength={120} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
              <TextAreaField id='cl-desc' label='Description' maxLength={1000} rows={2} value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} />
              <TextField id='cl-max' label='Max members' type='number' min={1} max={100000} value={edit.maxMembers} onChange={e => setEdit({ ...edit, maxMembers: e.target.value })} />
              <SwitchField id='cl-active' label='Active' checked={edit.isActive} onChange={isActive => setEdit({ ...edit, isActive })} />
            </FormDialog>
            <FormDialog
              trigger={<Button variant='outline' size='sm'><PercentIcon /> Earnings split</Button>}
              title='Earnings split'
              description='What the platform pays the owner, agents and members on every wager the club generates. Percentages like "12.5"; leave blank to keep.'
              onSubmit={() => setConfig.mutateAsync()}
              onOpenChange={o => o && setCfg({ ownerPercentage: '', agentPercentage: '', memberPercentage: '', activePlayerThreshold: '', wagerThreshold: '' })}
            >
              <div className='grid grid-cols-3 gap-3'>
                <TextField id='ec-o' label='Owner %' placeholder={c.earnings.owner} value={cfg.ownerPercentage} onChange={e => setCfg({ ...cfg, ownerPercentage: e.target.value })} />
                <TextField id='ec-a' label='Agent %' placeholder={c.earnings.agent} value={cfg.agentPercentage} onChange={e => setCfg({ ...cfg, agentPercentage: e.target.value })} />
                <TextField id='ec-m' label='Member %' placeholder={c.earnings.member} value={cfg.memberPercentage} onChange={e => setCfg({ ...cfg, memberPercentage: e.target.value })} />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <TextField id='ec-ap' label='Min active players' type='number' min={0} value={cfg.activePlayerThreshold} onChange={e => setCfg({ ...cfg, activePlayerThreshold: e.target.value })} />
                <TextField id='ec-wt' label='Active-player wager threshold' placeholder='100.00' value={cfg.wagerThreshold} onChange={e => setCfg({ ...cfg, wagerThreshold: e.target.value })} />
              </div>
            </FormDialog>
            <ConfirmDialog
              trigger={<Button variant='destructive' size='sm'><Trash2Icon /> Delete</Button>}
              title={`Delete ${c.name}?`}
              description='Every membership goes with it. The owner and members keep their player accounts.'
              confirmLabel='Delete club'
              destructive
              onConfirm={() => remove.mutateAsync()}
            />
          </Can>
          <Button variant='ghost' size='sm' onClick={onClose}>Close</Button>
        </CardTitle>
        <CardDescription className='flex flex-wrap gap-x-4'>
          <span>owner <Link href={`/players/${c.ownerId}`} className='underline'>#{String(c.ownerId)}</Link></span>
          <span>{formatNumber(c.members ?? club.members)} members{c.maxMembers ? ` of ${formatNumber(c.maxMembers)}` : ''}</span>
          <span>split owner {c.earnings.owner}% · agent {c.earnings.agent}% · member {c.earnings.member}%</span>
          {c.parentClubId && <span>parent club #{c.parentClubId}</span>}
          {c.description && <span className='basis-full'>{c.description}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {detail.error && <ErrorState error={detail.error} />}
        <Tabs defaultValue='members'>
          <TabsList className='mb-3'>
            <TabsTrigger value='members'>Members</TabsTrigger>
            <TabsTrigger value='earnings'>Earnings</TabsTrigger>
          </TabsList>
          <TabsContent value='members'>
            <DataTable
              columns={memberColumns}
              rows={memberList.data?.rows}
              rowKey={r => r.id}
              loading={memberList.isLoading}
              fetching={memberList.isFetching}
              error={memberList.error}
              pagination={memberList.data?.pagination}
              onPageChange={p => members.set({ page: p })}
              onLimitChange={l => members.set({ limit: l })}
              dense
              toolbar={
                <Select value={role} onValueChange={v => { if (v) { setRole(v); members.set({ page: 1 }) } }}>
                  <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All roles</SelectItem>
                    <SelectItem value='owner'>Owner</SelectItem>
                    <SelectItem value='agent'>Agent</SelectItem>
                    <SelectItem value='member'>Member</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </TabsContent>
          <TabsContent value='earnings'>
            <DataTable
              columns={earningColumns}
              rows={earningList.data?.rows}
              rowKey={r => r.id}
              loading={earningList.isLoading}
              fetching={earningList.isFetching}
              error={earningList.error}
              pagination={earningList.data?.pagination}
              onPageChange={p => earnings.set({ page: p })}
              onLimitChange={l => earnings.set({ limit: l })}
              dense
              emptyMessage='No earnings logged for this club.'
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

const Clubs = () => {
  const { state, set, query } = useListState(['activeOnly'])
  const list = usePagedApi<Club>('admin/user/clubs', {
    limit: query.limit,
    page: query.page,
    search: state.search || undefined,
    activeOnly: state.activeOnly === '1' ? true : undefined
  })
  const [selected, setSelected] = useState<Club | null>(null)

  const columns: Column<Club>[] = [
    {
      key: 'name',
      header: 'Club',
      cell: r => (
        <div className='flex flex-col'>
          <span className='font-medium'>{r.name}</span>
          <span className='text-muted-foreground font-mono text-xs'>{r.code}</span>
        </div>
      )
    },
    { key: 'owner', header: 'Owner', cell: r => <Link href={`/players/${r.ownerId}`} className='font-mono text-xs hover:underline' onClick={e => e.stopPropagation()}>#{String(r.ownerId)}</Link> },
    { key: 'members', header: 'Members', align: 'right', cell: r => `${formatNumber(r.members)}${r.maxMembers ? ` / ${formatNumber(r.maxMembers)}` : ''}` },
    { key: 'split', header: 'Split (O / A / M)', cell: r => <span className='tabular-nums'>{r.earnings.owner}% / {r.earnings.agent}% / {r.earnings.member}%</span> },
    { key: 'status', header: 'Status', cell: r => <StatusBadge value={r.isActive ? 'active' : 'inactive'} /> }
  ]

  return (
    <div className='grid gap-4'>
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
        searchPlaceholder='Club name…'
        onRowClick={setSelected}
        emptyMessage='No clubs have been created. Players create clubs from the site; staff manage them here.'
        toolbar={
          <Select value={state.activeOnly === '1' ? '1' : 'all'} onValueChange={v => v && set({ activeOnly: v === '1' ? '1' : '' })}>
            <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All clubs</SelectItem>
              <SelectItem value='1'>Active only</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      {selected && <ClubDetail key={selected.id} club={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

const VipClub = () => (
  <div>
    <PageHeader title='VIP & club' description='The VIP ladder players climb by wagering, and the clubs (owner → agents → members) that share in club turnover.' />
    <Tabs defaultValue='clubs'>
      <TabsList className='mb-4'>
        <TabsTrigger value='clubs'>Clubs</TabsTrigger>
        <TabsTrigger value='vip'>VIP ladder</TabsTrigger>
      </TabsList>
      <TabsContent value='clubs'><Clubs /></TabsContent>
      <TabsContent value='vip'><VipLadder /></TabsContent>
    </Tabs>
  </div>
)

export default VipClub
