'use client'

import { useState } from 'react'

import { KeyRoundIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react'
import { toast } from 'sonner'

import FormDialog from '@/components/shared/FormDialog'
import { TextField } from '@/components/shared/FormField'
import PageHeader from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/contexts/SessionContext'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'

type TwoFactor = { enabled: boolean; enrolledAt?: string | null; pending?: boolean; required?: boolean }
type Begin = { secret?: string; otpauthUrl?: string; otpauth?: string; qr?: string; qrDataUrl?: string }

const MyAccount = () => {
  const { actor } = useSession()
  const status = useApi<TwoFactor>('admin/auth/2fa')
  const [setup, setSetup] = useState<Begin | null>(null)
  const [code, setCode] = useState('')
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '', confirm: '' })
  const [disable, setDisable] = useState({ password: '', code: '' })

  const begin = useApiMutation({ fn: () => api.post<Begin>('admin/auth/2fa/begin'), onSuccess: r => setSetup(r) })
  const confirm = useApiMutation({
    fn: () => api.post('admin/auth/2fa/confirm', { code }),
    invalidate: [['api', 'admin/auth/2fa']],
    success: 'Two-factor authentication is on',
    onSuccess: () => {
      setSetup(null)
      setCode('')
    }
  })
  const turnOff = useApiMutation({
    fn: () => api.post('admin/auth/2fa/disable', { password: disable.password, code: disable.code }),
    invalidate: [['api', 'admin/auth/2fa']],
    success: 'Two-factor authentication is off'
  })
  const changePassword = useApiMutation({
    fn: () => {
      if (pw.newPassword !== pw.confirm) {
        toast.error('The two new passwords do not match')
        throw new Error('mismatch')
      }

      return api.patch('admin/staff/password', { oldPassword: pw.oldPassword, newPassword: pw.newPassword })
    },
    success: 'Password changed',
    onSuccess: () => setPw({ oldPassword: '', newPassword: '', confirm: '' })
  })

  const otpauth = setup?.otpauthUrl ?? setup?.otpauth
  const qr = setup?.qrDataUrl ?? setup?.qr

  return (
    <div>
      <PageHeader title='My account' description='Your staff identity on this site, your second factor and your password.' />
      <div className='grid gap-6 lg:grid-cols-2'>
        <Card className='shadow-none'>
          <CardHeader>
            <CardTitle className='text-base'>Identity</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-2 text-sm'>
            <div className='flex justify-between'><span className='text-muted-foreground'>Staff id</span><span className='font-mono'>#{actor?.staffId}</span></div>
            <div className='flex justify-between'><span className='text-muted-foreground'>Role</span><span>{actor?.roleName} (level {actor?.level})</span></div>
            <div className='flex justify-between'><span className='text-muted-foreground'>Session expires</span><span>{actor?.expiresAt ? new Date(actor.expiresAt).toLocaleString() : '—'}</span></div>
            <div>
              <span className='text-muted-foreground'>Permissions</span>
              <div className='mt-1 flex flex-wrap gap-1'>
                {actor?.permissions.map(p => (
                  <Badge key={p} variant='outline' className='font-mono text-xs'>
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className='shadow-none'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              {status.data?.enabled ? <ShieldCheckIcon className='text-green-600' /> : <ShieldOffIcon className='text-muted-foreground' />}
              Two-factor authentication
            </CardTitle>
            <CardDescription>
              {status.data?.enabled ? 'On. Every sign-in asks for a 6-digit code.' : 'Off. Senior roles cannot sign in without it once STAFF_2FA_REQUIRED_LEVEL applies.'}
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3'>
            {!status.data?.enabled && !setup && (
              <Button onClick={() => begin.mutate()} disabled={begin.isPending}>
                Start enrolment
              </Button>
            )}
            {setup && (
              <div className='grid gap-3'>
                {qr && <img src={qr} alt='Scan with your authenticator' className='size-44 rounded-md border bg-white p-2' />}
                {otpauth && <p className='text-muted-foreground text-xs break-all'>{otpauth}</p>}
                {setup.secret && <p className='text-sm'>Secret: <code>{setup.secret}</code></p>}
                <TextField id='code' label='Code from the app' inputMode='numeric' maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
                <div className='flex gap-2'>
                  <Button onClick={() => confirm.mutate()} disabled={code.length !== 6 || confirm.isPending}>
                    Confirm
                  </Button>
                  <Button variant='outline' onClick={() => setSetup(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {status.data?.enabled && (
              <FormDialog
                trigger={<Button variant='destructive'>Turn off</Button>}
                title='Turn off two-factor'
                description='Needs your password and a current code, so a stolen session alone cannot remove it.'
                submitLabel='Turn off'
                destructive
                onSubmit={() => turnOff.mutateAsync()}
              >
                <TextField id='d-pw' label='Password' type='password' required value={disable.password} onChange={e => setDisable({ ...disable, password: e.target.value })} />
                <TextField id='d-code' label='Current code' inputMode='numeric' maxLength={6} required value={disable.code} onChange={e => setDisable({ ...disable, code: e.target.value })} />
              </FormDialog>
            )}
          </CardContent>
        </Card>

        <Card className='shadow-none'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <KeyRoundIcon /> Change password
            </CardTitle>
            <CardDescription>At least 12 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className='grid gap-3'
              onSubmit={e => {
                e.preventDefault()
                changePassword.mutate()
              }}
            >
              <TextField id='p-old' label='Current password' type='password' required value={pw.oldPassword} onChange={e => setPw({ ...pw, oldPassword: e.target.value })} />
              <TextField id='p-new' label='New password' type='password' required minLength={12} value={pw.newPassword} onChange={e => setPw({ ...pw, newPassword: e.target.value })} />
              <TextField id='p-confirm' label='Repeat new password' type='password' required minLength={12} value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} />
              <Button type='submit' disabled={changePassword.isPending} className='justify-self-start'>
                Change password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default MyAccount
