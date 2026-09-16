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

type Email = { sendFrom?: string | null; alertsTo?: string | null; hasAppPassword?: boolean; [k: string]: unknown }

const EmailSettings = () => {
  const { can } = useSession()
  const q = useApi<Email>('admin/site-config/email')
  const [form, setForm] = useState({ sendFrom: '', alertsTo: '', appPassword: '' })
  const [testTo, setTestTo] = useState('')

  useEffect(() => {
    if (q.data) setForm(f => ({ ...f, sendFrom: q.data.sendFrom ?? '', alertsTo: q.data.alertsTo ?? '' }))
  }, [q.data])

  const save = useApiMutation({
    fn: () => {
      const patch: Record<string, string> = {}

      if (form.sendFrom !== (q.data?.sendFrom ?? '')) patch.sendFrom = form.sendFrom
      if (form.alertsTo !== (q.data?.alertsTo ?? '')) patch.alertsTo = form.alertsTo
      if (form.appPassword) patch.appPassword = form.appPassword

      return api.put('admin/site-config/email', patch)
    },
    invalidate: [['api', 'admin/site-config/email']],
    success: 'Email settings saved',
    onSuccess: () => setForm(f => ({ ...f, appPassword: '' }))
  })

  const test = useApiMutation({
    fn: () => api.post('admin/site-config/email/test', testTo ? { to: testTo } : {}),
    success: 'Test email sent (check MAIL_DRY_RUN / SMTP in the backend .env if nothing arrives)'
  })

  return (
    <div>
      <PageHeader title='Email (SMTP sender)' description='The address the platform sends from and where operator alerts go. The SMTP host itself is backend configuration (owner panel → environment).' />
      {q.error && <ErrorState error={q.error} />}
      <div className='grid gap-6 lg:grid-cols-2'>
        <Card className='shadow-none'>
          <CardHeader>
            <CardTitle className='text-base'>Sender</CardTitle>
            <CardDescription>The app password is write-only; the platform never returns it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-4'
              onSubmit={e => {
                e.preventDefault()
                save.mutate()
              }}
            >
              <TextField id='sendFrom' label='Send from' type='email' value={form.sendFrom} onChange={e => setForm({ ...form, sendFrom: e.target.value })} />
              <TextField id='alertsTo' label='Alerts to' type='email' hint='Payment webhooks and operator notices' value={form.alertsTo} onChange={e => setForm({ ...form, alertsTo: e.target.value })} />
              <TextField id='appPassword' label='App password' type='password' placeholder={q.data?.hasAppPassword ? '•••••••• (set)' : 'not set'} value={form.appPassword} onChange={e => setForm({ ...form, appPassword: e.target.value })} />
              <Button type='submit' disabled={save.isPending || !can('config:write')} className='justify-self-start'>
                Save
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className='shadow-none'>
          <CardHeader>
            <CardTitle className='text-base'>Send a test</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4'>
            <TextField id='testTo' label='To (optional)' type='email' hint='Defaults to the alerts address' value={testTo} onChange={e => setTestTo(e.target.value)} />
            <Button variant='outline' onClick={() => test.mutate()} disabled={test.isPending || !can('config:write')} className='justify-self-start'>
              Send test email
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default EmailSettings
