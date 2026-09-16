'use client'

import { useCallback, useMemo, useState } from 'react'

import ErrorState from '@/components/shared/ErrorState'
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { formatNumber } from '@/lib/format'
import DateTime from '@/components/shared/DateTime'
import OrderedList, { type OrderedItem } from './OrderedList'
import type { GisGame, GisPriority, GisType, GisVendor, JsCuration, JsGame, JsScopeEntry } from './types'

const JS_SCOPES = [
  { value: 'collection', label: 'Collection', path: 'admin/casino/js-games/v1/collections' },
  { value: 'vendor', label: 'Vendor', path: 'admin/casino/js-games/v1/vendors' },
  { value: 'type', label: 'Type', path: 'admin/casino/js-games/v1/types' }
] as const

const jsItem = (g: JsGame): OrderedItem => ({ id: g.game_uid, name: g.game_name, vendor: g.vendor, type: g.game_type, image: g.game_icon, inactive: !g.is_active })
const gisItem = (g: GisGame): OrderedItem => ({ id: g.uuid, name: g.name, vendor: g.provider, type: g.type, image: g.image })

/** Lobby curation — orders `js_games`, which is what players see. */
const LobbyTab = () => {
  const { can } = useSession()
  const [scope, setScope] = useState<(typeof JS_SCOPES)[number]['value']>('collection')
  const [key, setKey] = useState('')
  const scopeDef = JS_SCOPES.find(s => s.value === scope)!
  const keys = useApi<JsScopeEntry[]>(scopeDef.path)
  const keyName = (e: JsScopeEntry) => e.key ?? e.name ?? ''
  const path = key ? `admin/casino/js-games/v1/curation/${scope}/${encodeURIComponent(key)}` : null
  const curation = useApi<JsCuration>(path)

  const save = useApiMutation({
    fn: (gameUids: string[]) => api.put(path as string, { gameUids }),
    invalidate: [['api', path], ['api', scopeDef.path]],
    success: 'Order saved — the lobby reads it on the next request'
  })

  const search = useCallback(
    async (q: string) => {
      const query: Record<string, string | number> = { q, limit: 100 }

      // Within a vendor/type list only that vendor's/type's games make sense.
      if (scope === 'vendor') query.vendor = key
      if (scope === 'type') query.type = key
      const rows = await api.get<JsGame[]>('admin/casino/js-games/v1/catalogue/search', query)

      return rows.map(jsItem)
    },
    [scope, key]
  )

  const items = useMemo(() => curation.data?.games.map(jsItem), [curation.data])
  const selected = keys.data?.find(e => keyName(e) === key)

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Select
          value={scope}
          onValueChange={v => {
            if (!v) return
            setScope(v as typeof scope)
            setKey('')
          }}
        >
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JS_SCOPES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={key} onValueChange={v => v && setKey(v)}>
          <SelectTrigger className='w-64'>
            <SelectValue placeholder={`Choose a ${scopeDef.label.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent>
            {(keys.data ?? []).map(e => (
              <SelectItem key={keyName(e)} value={keyName(e)}>
                {e.label ?? keyName(e)} · {formatNumber(e.games)} games{e.curated ? ' · curated' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected && (
          <span className='text-muted-foreground text-sm'>
            {selected.curated ? (
              <>
                Curated <DateTime value={selected.updatedAt} relative />
              </>
            ) : (
              'Not curated yet — the lobby shows the default order.'
            )}
          </span>
        )}
      </div>
      {keys.error && <ErrorState error={keys.error} />}
      {curation.error && <ErrorState error={curation.error} />}
      {key ? (
        <OrderedList
          items={items}
          loading={curation.isLoading}
          search={search}
          onSave={ids => save.mutateAsync(ids)}
          canWrite={can('casino:manage')}
          max={500}
          header={
            <div className='flex items-center gap-2'>
              <Badge variant='outline'>{scopeDef.label}</Badge>
              <span className='font-medium'>{selected?.label ?? key}</span>
            </div>
          }
        />
      ) : (
        <p className='text-muted-foreground text-sm'>Pick a {scopeDef.label.toLowerCase()} to see and edit its order.</p>
      )}
    </div>
  )
}

/** Aggregator collections — the five GIS home rows. */
const GIS_COLLECTIONS = [
  { value: 'hot', label: 'Hot games' },
  { value: 'live-casino', label: 'Live casino' },
  { value: 'popular-slots', label: 'Popular slots' },
  { value: 'crash', label: 'Crash games' },
  { value: 'indian', label: 'Indian games' }
]

const gisSearch = async (q: string) => (await api.get<GisGame[]>('admin/casino/games/catalogue/search', { q, limit: 100 })).map(gisItem)

const CollectionsTab = () => {
  const { can } = useSession()
  const [collection, setCollection] = useState('hot')
  const path = `admin/casino/games/collections/${collection}`
  const list = useApi<GisGame[]>(path, { limit: 1000, page: 1 })
  const save = useApiMutation({ fn: (uuids: string[]) => api.put(path, { uuids }), invalidate: [['api', path]], success: 'Collection saved' })
  const items = useMemo(() => list.data?.map(gisItem), [list.data])

  return (
    <div className='grid gap-4'>
      <Tabs value={collection} onValueChange={v => v && setCollection(String(v))}>
        <TabsList className='flex-wrap'>
          {GIS_COLLECTIONS.map(c => (
            <TabsTrigger key={c.value} value={c.value}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {list.error && <ErrorState error={list.error} />}
      <OrderedList items={items} loading={list.isLoading} search={gisSearch} onSave={ids => save.mutateAsync(ids)} canWrite={can('casino:manage')} max={5000} header={<span className='font-medium'>{GIS_COLLECTIONS.find(c => c.value === collection)?.label}</span>} />
    </div>
  )
}

/** Per-vendor or per-type pinned order in the aggregator catalogue. */
const PriorityTab = ({ kind }: { kind: 'vendor' | 'type' }) => {
  const { can } = useSession()
  const [key, setKey] = useState('')
  const options = useApi<(GisVendor | GisType)[]>(kind === 'vendor' ? 'admin/casino/games/vendors' : 'admin/casino/games/types')
  const path = key ? `admin/casino/games/${kind === 'vendor' ? 'priority' : 'type-priority'}/${encodeURIComponent(key)}` : null
  const priority = useApi<GisPriority>(path)
  const save = useApiMutation({ fn: (uuids: string[]) => api.put(path as string, { uuids }), invalidate: [['api', path]], success: 'Priority saved' })
  const items = useMemo(() => priority.data?.games.map(gisItem), [priority.data])
  const search = useCallback(async (q: string) => (await api.get<GisGame[]>(`admin/casino/games/${kind}-search`, { q, limit: 100, [kind]: key })).map(gisItem), [kind, key])
  const nameOf = (o: GisVendor | GisType) => String((o as GisVendor).vendor ?? (o as GisType).type)

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <Select value={key} onValueChange={v => v && setKey(v)}>
          <SelectTrigger className='w-64'>
            <SelectValue placeholder={`Choose a ${kind}…`} />
          </SelectTrigger>
          <SelectContent>
            {(options.data ?? []).map(o => (
              <SelectItem key={nameOf(o)} value={nameOf(o)}>
                {nameOf(o)} {o.total !== undefined ? `· ${formatNumber(o.total)} games` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {priority.data && (
          <span className='text-muted-foreground text-sm'>
            {priority.data.updated_at ? (
              <>
                Pinned order saved <DateTime value={priority.data.updated_at} relative />
              </>
            ) : (
              'No pinned order — catalogue order applies.'
            )}
          </span>
        )}
      </div>
      {options.error && <ErrorState error={options.error} />}
      {options.data && options.data.length === 0 && <p className='text-muted-foreground text-sm'>The aggregator catalogue is empty. Sync games first (Game catalogue → Providers & sync).</p>}
      {priority.error && <ErrorState error={priority.error} />}
      {key ? (
        <OrderedList items={items} loading={priority.isLoading} search={search} onSave={ids => save.mutateAsync(ids)} canWrite={can('casino:manage')} max={5000} header={<span className='font-medium capitalize'>{kind}: {key}</span>} />
      ) : (
        <p className='text-muted-foreground text-sm'>Pick a {kind} to pin games to the top of its list.</p>
      )}
    </div>
  )
}

const Curation = () => (
  <div>
    <PageHeader title='Curation & priority' description='What the lobby shows and in what order. "Lobby" orders the games the site actually renders; the aggregator tabs order the Slotegrator catalogue.' />
    <Tabs defaultValue='lobby'>
      <TabsList className='mb-4 flex-wrap'>
        <TabsTrigger value='lobby'>Lobby (js-games)</TabsTrigger>
        <TabsTrigger value='collections'>Aggregator collections</TabsTrigger>
        <TabsTrigger value='vendor'>Vendor priority</TabsTrigger>
        <TabsTrigger value='type'>Type priority</TabsTrigger>
      </TabsList>
      <TabsContent value='lobby'>
        <LobbyTab />
      </TabsContent>
      <TabsContent value='collections'>
        <CollectionsTab />
      </TabsContent>
      <TabsContent value='vendor'>
        <PriorityTab kind='vendor' />
      </TabsContent>
      <TabsContent value='type'>
        <PriorityTab kind='type' />
      </TabsContent>
    </Tabs>
  </div>
)

export default Curation
