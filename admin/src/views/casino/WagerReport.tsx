'use client'

import { useState } from 'react'

import { SearchIcon } from 'lucide-react'

import ErrorState from '@/components/shared/ErrorState'
import JsonView from '@/components/shared/JsonView'
import PageHeader from '@/components/shared/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useApi } from '@/hooks/use-api'

type Props = { area: 'casino' | 'sports' }

/**
 * The wager-report module in both services exposes only INTERNAL routes
 * (`/internal/<service>/wager/turnover/:userId`, `/race-points`) — nothing on
 * the admin audience. This screen tries the admin-shaped path so it lights up
 * the moment the backend adds one, and says clearly why it is empty until then.
 */
const WagerReport = ({ area }: Props) => {
  const [userId, setUserId] = useState('')
  const [lookup, setLookup] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const turnover = useApi<unknown>(lookup ? `admin/${area}/wager/turnover/${lookup}` : null, { from: from || undefined, to: to || undefined }, { retry: false })

  return (
    <div>
      <PageHeader title={`${area === 'casino' ? 'Casino' : 'Sports'} wager report`} description='Stake turnover per player for a period — the figure VIP, races and rakeback are computed from.' />
      <Alert className='mb-6'>
        <AlertTitle>Not exposed to staff yet</AlertTitle>
        <AlertDescription>
          The backend&apos;s <code>{area}/wager-report</code> module only has internal routes (<code>/internal/{area}/wager/turnover/:userId</code> and <code>/race-points</code>), which the gateway does not serve to the admin. Until an <code>admin/{area}/wager/…</code> route exists, use the per-player Wagered figure on the player&apos;s page.
        </AlertDescription>
      </Alert>
      <Card className='max-w-2xl shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>Turnover lookup</CardTitle>
          <CardDescription>Calls <code>admin/{area}/wager/turnover/:userId</code>. Shows the platform&apos;s answer, including the 404 while the route is missing.</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-3'>
          <form
            className='flex flex-wrap gap-2'
            onSubmit={e => {
              e.preventDefault()
              setLookup(userId.trim() || null)
            }}
          >
            <Input placeholder='User id' className='w-32' value={userId} onChange={e => setUserId(e.target.value)} />
            <Input type='date' className='w-40' value={from} onChange={e => setFrom(e.target.value)} />
            <Input type='date' className='w-40' value={to} onChange={e => setTo(e.target.value)} />
            <Button type='submit' variant='outline' disabled={!userId.trim()}>
              <SearchIcon /> Look up
            </Button>
          </form>
          {turnover.error && <ErrorState error={turnover.error} title='The platform answered' />}
          {turnover.data !== undefined && <JsonView value={turnover.data} />}
        </CardContent>
      </Card>
    </div>
  )
}

export default WagerReport
