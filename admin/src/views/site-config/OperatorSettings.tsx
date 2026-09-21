'use client'

import { useState } from 'react'

import ErrorState from '@/components/shared/ErrorState'
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'

/**
 * Limits, policy and schedule — the values that used to be environment
 * variables.
 *
 * ── WHY THEY ARE HERE ───────────────────────────────────────────────────
 *
 * The minimum bet, the maximum payout, the timezone a race week resets in:
 * these are the operator's decisions, and while they lived in `.env` changing
 * one meant a deploy by whoever held shell access. They are stored per site
 * now, set here, and every write is permissioned and audited.
 *
 * WHAT IS NOT SET HERE stays in `.env` on purpose: credentials, ports, service
 * URLs, CORS, worker intervals. Those say where the software runs, which is a
 * deployment's business, not an operator's.
 *
 * Each row shows where its value comes from. `Deployment` means nothing is
 * stored and the service is reading the environment variable named beside it;
 * saving makes it yours, and `Use deployment value` hands it back.
 */

type Setting = {
  key: string
  label: string
  kind: 'number' | 'decimal' | 'boolean' | 'timezone'
  env: string
  envValue: string | null
  stored: string | number | boolean | null
  value: string | number | boolean | null
  source: 'operator' | 'environment'
  min?: number
  max?: number
}

const GROUPS: { title: string; hint: string; keys: string[] }[] = [
  {
    title: 'Casino',
    hint: 'What a player may stake on an in-house game, and how often the provably-fair seed rotates.',
    keys: ['casino_house_edge', 'casino_min_bet', 'casino_max_bet', 'casino_seed_rotate_after']
  },
  {
    title: 'Sportsbook',
    hint: 'Stake and payout limits per betslip, how far the odds may drift between the board and the bet, and the day boundary.',
    keys: [
      'sports_min_stake',
      'sports_max_stake',
      'sports_max_selections',
      'sports_max_payout',
      'sports_odds_tolerance',
      'sports_timezone',
      'race_timezone'
    ]
  },
  {
    title: 'Cashier',
    hint: 'Deposit and withdrawal limits, and the amount below which a withdrawal needs no human.',
    keys: ['deposit_minimum', 'deposit_maximum', 'withdraw_maximum', 'withdrawal_auto_approve_limit']
  },
  {
    title: 'Player accounts',
    hint: 'How a sign-in locks, how many sessions a player keeps, and whether an email must be verified before money moves.',
    keys: ['login_max_attempts', 'login_lock_minutes', 'max_active_sessions', 'require_email_verification']
  }
]

const OperatorSettings = () => {
  const { can } = useSession()
  const canWrite = can('config:write')
  const q = useApi<Setting[]>('admin/site-config/settings')
  const [draft, setDraft] = useState<Record<string, string | boolean | null>>({})

  const save = useApiMutation({
    fn: () => api.put<Setting[]>('admin/site-config/settings', draft),
    invalidate: [['api', 'admin/site-config/settings']],
    success: 'Saved — the services pick it up on their next read',
    onSuccess: () => setDraft({})
  })

  if (q.error) return <ErrorState error={q.error} />

  const rows = q.data ?? []
  const byKey = Object.fromEntries(rows.map(r => [r.key, r]))
  const dirty = Object.keys(draft)

  const field = (s: Setting) => {
    const pending = s.key in draft
    const current = pending ? draft[s.key] : s.value

    if (s.kind === 'boolean') {
      return (
        <Switch
          checked={current === true || current === 'true'}
          disabled={!canWrite}
          onCheckedChange={v => setDraft(d => ({ ...d, [s.key]: v }))}
        />
      )
    }

    return (
      <Input
        className='h-8 w-44 font-mono text-xs'
        value={current === null || current === undefined ? '' : String(current)}
        placeholder={s.envValue ?? 'not set'}
        disabled={!canWrite}
        onChange={e => setDraft(d => ({ ...d, [s.key]: e.target.value }))}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title='Limits and policy'
        description='The numbers this site runs on. Each one used to be an environment variable; changing one is now a save, not a deploy.'
      />

      {dirty.length > 0 && (
        <div className='mb-4 flex items-center gap-2'>
          <Button onClick={() => save.mutateAsync()} disabled={save.isPending}>
            Save {dirty.length} change{dirty.length > 1 ? 's' : ''}
          </Button>
          <Button variant='outline' onClick={() => setDraft({})}>
            Discard
          </Button>
        </div>
      )}

      <div className='grid gap-4'>
        {GROUPS.map(group => (
          <Card key={group.title} className='shadow-none'>
            <CardHeader>
              <CardTitle className='text-base'>{group.title}</CardTitle>
              <CardDescription>{group.hint}</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {group.keys.map(key => {
                const s = byKey[key]

                if (!s) return null

                return (
                  <div key={key} className='flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0'>
                    <div className='min-w-56'>
                      <span className='block text-sm font-medium'>{s.label}</span>
                      <span className='text-muted-foreground font-mono text-[11px]'>{s.env}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      {field(s)}
                      {s.source === 'operator' ? (
                        <>
                          <Badge variant='outline'>yours</Badge>
                          {canWrite && (
                            <Button
                              size='sm'
                              variant='ghost'
                              onClick={() => setDraft(d => ({ ...d, [s.key]: null }))}
                              title={`Fall back to ${s.env}`}
                            >
                              Use deployment value
                            </Button>
                          )}
                        </>
                      ) : (
                        <Badge variant='secondary'>deployment</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default OperatorSettings
