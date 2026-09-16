'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useRouter, useSearchParams } from 'next/navigation'

// Third-party Imports
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import Logo from '@/components/shared/Logo'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'

// Config Imports
import { siteConfig } from '@/configs/site'

// Lib Imports
import { ApiError, errorMessage, request } from '@/lib/api/client'

// SVG Import
import AuthBackgroundShape from '@/assets/svg/auth-background-shape'

type Mode = 'staff' | 'executive'

const Login = () => {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<Mode>('staff')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // First-login: the platform refuses with PASSWORD_CHANGE_REQUIRED until a new password is set.
  const [mustChange, setMustChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      if (mustChange) {
        await request('admin/auth/first-login-password', {
          method: 'POST',
          body: { email: identifier, currentPassword: password, newPassword }
        })
        toast.success('Password changed. Sign in with the new one.')
        setPassword('')
        setNewPassword('')
        setMustChange(false)

        return
      }

      const body: Record<string, string> = { mode, password }

      if (mode === 'staff') body.email = identifier
      else body.username = identifier
      if (code) body.twoFactorCode = code

      const { data } = await request<{ firstLogin?: boolean; actor?: { name?: string } }>('/api/auth/login', {
        raw: true,
        method: 'POST',
        body
      })

      toast.success(`Signed in${data?.actor?.name ? ` as ${data.actor.name}` : ''}`)
      router.replace(params.get('next') || '/dashboard')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.is('TWO_FACTOR_REQUIRED')) {
          setNeedsCode(true)
          setError(null)
          setBusy(false)

          return
        }
        if (err.is('PASSWORD_CHANGE_REQUIRED')) {
          setMustChange(true)
          setError('This account must set a new password before it can sign in.')
          setBusy(false)

          return
        }
      }
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8'>
      <div className='absolute'>
        <AuthBackgroundShape />
      </div>

      <Card className='z-1 w-full gap-6 py-6 sm:max-w-md'>
        <CardHeader className='gap-6 px-6'>
          <Logo className='gap-3' />
          <div>
            <CardTitle className='mb-2 text-2xl font-semibold'>Sign in to {siteConfig.name}</CardTitle>
            <CardDescription className='text-base'>
              Staff sign-in for <span className='font-mono'>{siteConfig.key}</span> · {siteConfig.environment}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='px-6'>
          <Tabs value={mode} onValueChange={v => setMode(v as Mode)} className='mb-6'>
            <TabsList className='w-full'>
              <TabsTrigger value='staff' className='flex-1'>
                Staff
              </TabsTrigger>
              <TabsTrigger value='executive' className='flex-1'>
                Executive
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit}>
            <FieldGroup className='gap-4'>
              <Field className='gap-2'>
                <FieldLabel htmlFor='identifier'>{mode === 'staff' ? 'Email address' : 'Executive username'}</FieldLabel>
                <Input
                  id='identifier'
                  type={mode === 'staff' ? 'email' : 'text'}
                  autoComplete='username'
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  placeholder={mode === 'staff' ? 'admin@example.com' : 'username'}
                />
              </Field>

              <Field className='w-full gap-2'>
                <FieldLabel htmlFor='password'>{mustChange ? 'Current password' : 'Password'}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id='password'
                    type={visible ? 'text' : 'password'}
                    autoComplete='current-password'
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder='••••••••••••'
                  />
                  <InputGroupAddon align='inline-end' className='pr-1.5'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      onClick={() => setVisible(v => !v)}
                      className='text-muted-foreground rounded-l-none hover:bg-transparent'
                    >
                      {visible ? <EyeOffIcon /> : <EyeIcon />}
                      <span className='sr-only'>{visible ? 'Hide password' : 'Show password'}</span>
                    </Button>
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              {mustChange && (
                <Field className='gap-2'>
                  <FieldLabel htmlFor='newPassword'>New password</FieldLabel>
                  <Input
                    id='newPassword'
                    type='password'
                    autoComplete='new-password'
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </Field>
              )}

              {needsCode && (
                <Field className='gap-2'>
                  <FieldLabel htmlFor='code'>Authenticator code</FieldLabel>
                  <Input
                    id='code'
                    inputMode='numeric'
                    pattern='[0-9]{6}'
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    placeholder='123456'
                  />
                </Field>
              )}

              {error && (
                <Alert variant='destructive'>
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Field>
                <Button className='w-full' type='submit' disabled={busy}>
                  {busy && <Loader2Icon className='animate-spin' />}
                  {mustChange ? 'Set new password' : needsCode ? 'Verify and sign in' : 'Sign in'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}

export default Login
