'use client'

import { useEffect, useState } from 'react'

import { TextField } from '@/components/shared/FormField'
import ErrorState from '@/components/shared/ErrorState'
import PageHeader from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'

type Affiliate = { affiliateBonus: string; commissionPercent: string; registerBonus: string }

const AffiliateSettings = () => {
  const { can } = useSession()
  const q = useApi<Affiliate>('admin/site-config/affiliate')
  const [form, setForm] = useState<Affiliate>({ affiliateBonus: '', commissionPercent: '', registerBonus: '' })

  useEffect(() => {
    if (q.data) setForm(q.data)
  }, [q.data])

  const save = useApiMutation({
    fn: () => {
      const patch: Partial<Affiliate> = {}

      for (const k of Object.keys(form) as (keyof Affiliate)[]) if (q.data && form[k] !== q.data[k]) patch[k] = form[k]

      return api.put<Affiliate>('admin/site-config/affiliate', patch)
    },
    invalidate: [['api', 'admin/site-config/affiliate']],
    success: 'Affiliate rates saved'
  })

  return (
    <div>
      <PageHeader title='Affiliate rates' description='What the site promises a new player and a referrer. Public by intent — the sign-up page shows these.' />
      {q.error && <ErrorState error={q.error} />}
      <Card className='max-w-xl shadow-none'>
        <CardHeader>
          <CardTitle className='text-base'>Rates</CardTitle>
          <CardDescription>Exact decimal strings. Commission is a percentage, capped at 100.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className='grid gap-4'
            onSubmit={e => {
              e.preventDefault()
              save.mutate()
            }}
          >
            <TextField id='registerBonus' label='Register bonus' hint='Credited to a new account on sign-up' value={form.registerBonus} onChange={e => setForm({ ...form, registerBonus: e.target.value })} />
            <TextField id='affiliateBonus' label='Affiliate bonus' hint='Paid to the referrer per referred sign-up' value={form.affiliateBonus} onChange={e => setForm({ ...form, affiliateBonus: e.target.value })} />
            <TextField id='commissionPercent' label='Commission %' hint='Share of referred players’ activity' value={form.commissionPercent} onChange={e => setForm({ ...form, commissionPercent: e.target.value })} />
            <Button type='submit' disabled={save.isPending || !can('config:write')} className='justify-self-start'>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AffiliateSettings
