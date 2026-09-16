'use client'

import { useMemo, useState } from 'react'

import { SendIcon, SettingsIcon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ErrorState from '@/components/shared/ErrorState'
import FormDialog from '@/components/shared/FormDialog'
import { TextField } from '@/components/shared/FormField'
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'
import { CATEGORY_LABELS, CATEGORY_ORDER, type Catalogue, type CatalogueFeature, type SiteFeature, type SiteFeatures } from './featureTypes'

const Integration = ({ feature, current, canWrite }: { feature: CatalogueFeature; current: SiteFeature; canWrite: boolean }) => {
  const [variant, setVariant] = useState(current.variant === 'none' ? feature.variants[0].key : current.variant)
  const spec = feature.variants.find(v => v.key === variant)!
  const [config, setConfig] = useState<Record<string, string>>(current.config ?? {})
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [testUser, setTestUser] = useState('')

  const save = useApiMutation({
    fn: () =>
      api.put(`admin/features/${feature.key}`, {
        variant,
        enabled: true,
        config: Object.fromEntries(spec.configFields.map(f => [f.key, config[f.key] ?? ''])),
        ...(Object.keys(secrets).length ? { secrets } : {})
      }),
    invalidate: [['api', 'admin/features']],
    success: `${feature.label} is on`,
    onSuccess: () => setSecrets({})
  })
  const test = useApiMutation({
    fn: () => api.post<{ accepted: number; failures: string[] }>(`admin/features/${feature.key}/test`, testUser ? { userId: Number(testUser) } : {}),
    success: r => (r.accepted ? 'Accepted by the provider' : `Sent — nobody subscribed${r.failures.length ? ` (${r.failures.join('; ')})` : ''}`)
  })

  if (!canWrite) return <Badge variant='outline'>{current.variantLabel}</Badge>

  return (
    <FormDialog
      trigger={
        <Button size='sm' variant='outline'>
          <SettingsIcon /> Configure
        </Button>
      }
      title={feature.label}
      description='Usually set once for every site from the owner panel. Keys are sealed and never shown again; leave one blank to keep it.'
      submitLabel='Save & switch on'
      onSubmit={() => save.mutateAsync()}
    >
      <Select value={variant} onValueChange={v => v && setVariant(v)}>
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {feature.variants
            .filter(v => v.key !== 'none')
            .map(v => (
              <SelectItem key={v.key} value={v.key}>
                {v.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {spec.configFields.map(f => (
        <TextField key={f.key} id={`c-${f.key}`} label={f.label} required={f.required} value={config[f.key] ?? ''} onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))} />
      ))}
      {spec.secretFields.map(f => (
        <TextField
          key={f.key}
          id={`s-${f.key}`}
          label={f.label}
          type='password'
          autoComplete='off'
          required={f.required && !current.secretsSet?.[f.key]}
          placeholder={current.secretsSet?.[f.key] ? '•••••••• stored' : 'not set'}
          value={secrets[f.key] ?? ''}
          onChange={e => setSecrets(s => ({ ...s, [f.key]: e.target.value }))}
        />
      ))}
      {current.enabled && current.variant === variant && spec.secretFields.length > 0 && (
        <div className='flex gap-2'>
          <input className='border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm' placeholder='Player id for a test (blank = segment)' value={testUser} onChange={e => setTestUser(e.target.value.replace(/\D/g, ''))} />
          <Button type='button' variant='outline' onClick={() => test.mutate()} disabled={test.isPending}>
            <SendIcon /> Test
          </Button>
        </div>
      )}
    </FormDialog>
  )
}

const Features = () => {
  const { can, refreshFlags } = useSession()
  const canWrite = can('config:write')
  const catalogue = useApi<Catalogue>('admin/features/catalogue')
  const current = useApi<SiteFeatures>('admin/features')
  const [template, setTemplate] = useState('')

  const update = useApiMutation({
    fn: (v: { feature: string; body: Record<string, unknown> }) => api.put(`admin/features/${v.feature}`, v.body),
    invalidate: [['api', 'admin/features']],
    success: (_r, v) => `${v.feature} updated`,
    onSuccess: () => refreshFlags()
  })
  const apply = useApiMutation({
    fn: (t: string) => api.put('admin/features/template', { template: t, enable: true }),
    invalidate: [['api', 'admin/features']],
    success: (_r, t) => `Template ${t} applied`,
    onSuccess: () => refreshFlags()
  })

  const rows = useMemo(() => {
    if (!catalogue.data || !current.data) return []
    const byKey = new Map(current.data.features.map(f => [f.feature, f]))

    return CATEGORY_ORDER.map(cat => ({
      cat,
      items: catalogue.data!.features.filter(f => f.category === cat).map(spec => ({ spec, cur: byKey.get(spec.key)! }))
    })).filter(g => g.items.length)
  }, [catalogue.data, current.data])

  const error = catalogue.error || current.error

  return (
    <div>
      <PageHeader
        title='Features'
        description='Which variant of each feature this site offers. Choosing Off hides the feature and switches its legacy flag off too.'
      />
      {error && <ErrorState error={error} />}
      {!rows.length && !error && <Skeleton className='h-96' />}

      {catalogue.data && current.data && (
        <Card className='mb-4 shadow-none'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              Template {current.data.template ? <Badge>{current.data.template}</Badge> : <Badge variant='outline'>none</Badge>}
            </CardTitle>
            <CardDescription>Sets every feature at once to the variant a clone was built with. Integrations keyed in are left alone.</CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            <Select value={template || current.data.template || ''} onValueChange={v => v && setTemplate(v)}>
              <SelectTrigger className='w-64'>
                <SelectValue placeholder='Choose a template' />
              </SelectTrigger>
              <SelectContent>
                {catalogue.data.templates.map(t => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Can permission='config:write'>
              <ConfirmDialog
                trigger={<Button disabled={!template}>Apply</Button>}
                title={`Apply ${template}?`}
                description={catalogue.data.templates.find(t => t.key === template)?.description}
                confirmLabel='Apply'
                onConfirm={() => apply.mutateAsync(template)}
              />
            </Can>
          </CardContent>
        </Card>
      )}

      <div className='grid gap-4'>
        {rows.map(({ cat, items }) => (
          <Card key={cat} className='gap-0 py-0 shadow-none'>
            <CardHeader className='border-b py-3'>
              <CardTitle className='text-sm font-semibold tracking-wide uppercase'>{CATEGORY_LABELS[cat] ?? cat}</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='pl-4'>Feature</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className='pr-4'>On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(({ spec, cur }) => (
                  <TableRow key={spec.key}>
                    <TableCell className='pl-4'>
                      <span className='block font-medium'>{spec.label}</span>
                      <span className='text-muted-foreground block max-w-md truncate text-xs'>{spec.variants.find(v => v.key === cur.variant)?.description}</span>
                    </TableCell>
                    <TableCell>
                      {spec.category === 'integration' ? (
                        <Integration feature={spec} current={cur} canWrite={canWrite} />
                      ) : (
                        <Select value={cur.variant} disabled={!canWrite} onValueChange={v => v && update.mutate({ feature: spec.key, body: { variant: v, enabled: v !== 'none' } })}>
                          <SelectTrigger className='w-48'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {spec.variants.map(v => (
                              <SelectItem key={v.key} value={v.key}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className='pr-4'>
                      <Switch
                        checked={cur.enabled}
                        disabled={!canWrite || cur.variant === 'none'}
                        onCheckedChange={enabled => update.mutate({ feature: spec.key, body: { enabled } })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default Features
