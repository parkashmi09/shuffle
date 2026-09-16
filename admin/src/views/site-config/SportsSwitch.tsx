'use client'

import ConfirmDialog from '@/components/shared/ConfirmDialog'
import ErrorState from '@/components/shared/ErrorState'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'

type Sports = { enabled: boolean; [k: string]: unknown }

const SportsSwitch = () => {
  const { can, refreshFlags } = useSession()
  const q = useApi<Sports>('admin/site-config/sports')
  const set = useApiMutation({
    fn: (enabled: boolean) => api.put('admin/site-config/sports', { enabled }),
    invalidate: [['api', 'admin/site-config/sports'], ['api', 'admin/site-config/global']],
    success: (_r, enabled) => (enabled ? 'Sportsbook is ON' : 'Sportsbook is OFF — bet placement refused'),
    onSuccess: () => refreshFlags()
  })
  const on = q.data?.enabled

  return (
    <div>
      <PageHeader title='Sports kill switch' description='One flag, read by sports-service on every bet. Off refuses new bets everywhere and hides the sportsbook; settlement of open bets continues.' />
      {q.error && <ErrorState error={q.error} />}
      <Card className='max-w-xl shadow-none'>
        <CardHeader>
          <CardTitle className='flex items-center gap-3 text-base'>
            Sportsbook <StatusBadge value={q.isLoading ? undefined : on ? 'enabled' : 'disabled'} />
          </CardTitle>
          <CardDescription>Has its own audit line, separate from the feature-flag screen.</CardDescription>
        </CardHeader>
        <CardContent>
          {on ? (
            <ConfirmDialog
              trigger={<Button variant='destructive' disabled={!can('config:write')}>Turn sports OFF</Button>}
              title='Turn the sportsbook off?'
              description='Players will not be able to place any sports bet until it is turned back on.'
              confirmLabel='Turn off'
              destructive
              onConfirm={() => set.mutateAsync(false)}
            />
          ) : (
            <Button onClick={() => set.mutate(true)} disabled={!can('config:write') || q.isLoading}>
              Turn sports ON
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SportsSwitch
