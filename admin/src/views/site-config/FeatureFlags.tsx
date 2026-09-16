'use client'

import { useEffect, useMemo, useState } from 'react'

import { Loader2Icon, RotateCcwIcon, SaveIcon } from 'lucide-react'

import ErrorState from '@/components/shared/ErrorState'
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { FLAG_GROUPS, flagLabel } from './flagGroups'

type Flags = Record<string, boolean>

const FeatureFlags = () => {
  const { can, refreshFlags } = useSession()
  const flags = useApi<Flags>('admin/site-config/global')
  const [draft, setDraft] = useState<Flags>({})
  const [filter, setFilter] = useState('')
  const canWrite = can('config:write')

  useEffect(() => {
    if (flags.data) setDraft(flags.data)
  }, [flags.data])

  const dirty = useMemo(() => Object.keys(draft).filter(k => flags.data && draft[k] !== flags.data[k]), [draft, flags.data])

  const save = useApiMutation({
    fn: () => {
      const patch: Flags = {}

      for (const k of dirty) patch[k] = draft[k]

      return api.put<Flags>('admin/site-config/global', patch)
    },
    invalidate: [['api', 'admin/site-config/global']],
    success: r => `${dirty.length} flag${dirty.length === 1 ? '' : 's'} saved`,
    onSuccess: () => refreshFlags()
  })

  const known = new Set(FLAG_GROUPS.flatMap(g => g.keys))
  const other = Object.keys(draft).filter(k => !known.has(k))
  const groups = other.length ? [...FLAG_GROUPS, { title: 'Other', description: 'Columns the platform returns that this screen does not yet know by name.', keys: other }] : FLAG_GROUPS
  const q = filter.trim().toLowerCase()

  return (
    <div>
      <PageHeader
        title='Feature flags'
        description='Every switch decides whether a section of the site renders. Saved to the platform; the site reads them on the next page load.'
        actions={
          <>
            <Input placeholder='Filter flags…' value={filter} onChange={e => setFilter(e.target.value)} className='w-48' />
            <Button variant='outline' disabled={!dirty.length || save.isPending} onClick={() => flags.data && setDraft(flags.data)}>
              <RotateCcwIcon /> Reset
            </Button>
            <Button disabled={!dirty.length || save.isPending || !canWrite} onClick={() => save.mutate()}>
              {save.isPending ? <Loader2Icon className='animate-spin' /> : <SaveIcon />}
              Save {dirty.length ? `(${dirty.length})` : ''}
            </Button>
          </>
        }
      />

      {flags.error && <ErrorState error={flags.error} />}
      {!canWrite && flags.data && (
        <p className='text-muted-foreground mb-4 text-sm'>Your role can read these flags but not change them (needs <code>config:write</code>).</p>
      )}

      <div className='grid gap-6 lg:grid-cols-2'>
        {groups.map(group => {
          const keys = group.keys.filter(k => k in draft && (!q || k.includes(q) || flagLabel(k).toLowerCase().includes(q)))

          if (flags.data && keys.length === 0) return null

          return (
            <Card key={group.title} className='shadow-none'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  {group.title}
                  {flags.data && (
                    <Badge variant='secondary' className='font-normal'>
                      {keys.filter(k => draft[k]).length}/{keys.length} on
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{group.description}</CardDescription>
              </CardHeader>
              <CardContent className='grid gap-1 sm:grid-cols-2'>
                {flags.isLoading
                  ? group.keys.slice(0, 6).map(k => <Skeleton key={k} className='h-9' />)
                  : keys.map(key => {
                      const changed = flags.data && draft[key] !== flags.data[key]

                      return (
                        <label
                          key={key}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${changed ? 'border-primary/60 bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}
                        >
                          <span className='min-w-0'>
                            <span className='block truncate'>{flagLabel(key)}</span>
                            <span className='text-muted-foreground block truncate font-mono text-xs'>{key}</span>
                          </span>
                          <Switch checked={!!draft[key]} disabled={!canWrite} onCheckedChange={v => setDraft(d => ({ ...d, [key]: v }))} />
                        </label>
                      )
                    })}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default FeatureFlags
