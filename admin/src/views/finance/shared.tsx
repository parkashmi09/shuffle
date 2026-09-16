'use client'

import { useState, type ReactNode } from 'react'

import { useQuery } from '@tanstack/react-query'
import { ImageIcon, WalletIcon } from 'lucide-react'

import FormDialog from '@/components/shared/FormDialog'
import { SelectField, TextAreaField, TextField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useApiMutation } from '@/hooks/use-api'
import { api, request } from '@/lib/api/client'
import type { Paged, Query } from '@/lib/api/types'
import { SUPPORTED_CURRENCIES } from './types'

/**
 * Some user-service listings page by `page`/`limit` rather than `limit`/`offset`
 * (deposit-reports, P2P — and P2P is `.strict()`, so `offset` is a 422 there).
 * `api.paged` always translates to `offset`, so those lists go through here.
 */
export function usePageNumbered<T>(path: string | null, query: Query) {
  return useQuery<Paged<T>>({
    queryKey: ['paged', path, query],
    enabled: path !== null,
    placeholderData: prev => prev,
    queryFn: async ({ signal }) => {
      const page = Math.max(Number(query.page ?? 1), 1)
      const limit = Number(query.limit ?? 20)
      const { data, meta } = await request<T[]>(path as string, { query: { ...query, page, limit }, signal })
      const pagination = (meta?.pagination as Paged<T>['pagination']) ?? {
        page,
        limit,
        total: Array.isArray(data) ? data.length : 0,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }

      return { rows: Array.isArray(data) ? data : [], pagination }
    }
  })
}

/** Label/value rows for a detail dialog. */
export const Details = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className='grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-2 text-sm'>
    {items.map(([k, v]) => (
      <div key={k} className='contents'>
        <dt className='text-muted-foreground'>{k}</dt>
        <dd className='min-w-0 break-words'>{v === null || v === undefined || v === '' ? <span className='text-muted-foreground'>—</span> : v}</dd>
      </div>
    ))}
  </dl>
)

/** A read-only dialog: trigger, title, children. */
export const ViewDialog = ({ trigger, title, description, children, wide }: { trigger: ReactNode; title: string; description?: ReactNode; children: ReactNode; wide?: boolean }) => (
  <Dialog>
    <DialogTrigger render={<span />}>{trigger}</DialogTrigger>
    <DialogContent className={wide ? 'sm:max-w-2xl' : undefined}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
)

/** An image served by a gateway route (the proxy adds the staff token). Loaded only once the dialog opens. */
export const ImageDialog = ({ path, title, label = 'View' }: { path: string; title: string; label?: string }) => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<span />}>
        <Button variant='outline' size='sm'>
          <ImageIcon /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {open && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={api.url(path)} alt={title} className='max-h-[70vh] w-full rounded-md object-contain' />
        )}
        <a href={api.url(path)} target='_blank' rel='noreferrer' className='text-muted-foreground text-xs underline'>
          Open in a new tab
        </a>
      </DialogContent>
    </Dialog>
  )
}

/** A native date input wired to a list filter (`YYYY-MM-DD`). */
export const DateInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <Input type='date' value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className='w-40' aria-label={placeholder} />
)

/** Stops a row click from also firing when an action button inside the row is pressed. */
export const stop = (e: React.MouseEvent) => e.stopPropagation()

/**
 * The same body as PlayerDetail's AdjustWallet — `POST admin/user/wallet/adjust`
 * with `{ userId, currency, amount, operation, description, transactionPassword? }`.
 */
export const AdjustWalletDialog = ({ userId, userName, currencies, invalidate = [], trigger }: { userId: string | number; userName?: string; currencies?: string[]; invalidate?: (string | null)[][]; trigger?: ReactNode }) => {
  const list = currencies?.length ? currencies : ['INR', 'USDT']
  const [form, setForm] = useState({ currency: list[0], amount: '', operation: 'credit', description: '', transactionPassword: '' })
  const adjust = useApiMutation({
    fn: () => {
      const body: Record<string, string | number> = { userId: Number(userId), currency: form.currency, amount: form.amount, operation: form.operation, description: form.description }

      if (form.transactionPassword) body.transactionPassword = form.transactionPassword

      return api.post('admin/user/wallet/adjust', body)
    },
    invalidate: [['paged', 'admin/user/wallet/balances'], ['api', `admin/reports/players/${userId}`], ['api', `admin/user/wallet/${userId}/balances`], ['paged', `admin/user/wallet/${userId}/history`], ...invalidate],
    success: 'Balance adjusted',
    onSuccess: () => setForm(f => ({ ...f, amount: '', description: '', transactionPassword: '' }))
  })

  return (
    <FormDialog
      trigger={
        trigger ?? (
          <Button variant='outline' size='sm'>
            <WalletIcon /> Adjust
          </Button>
        )
      }
      title={`Adjust wallet balance${userName ? ` — ${userName}` : ''}`}
      description={`Writes a ledger entry against player #${userId}. Credits add funds, debits remove them. A reason is required and audited.`}
      submitLabel='Apply'
      onSubmit={() => adjust.mutateAsync()}
    >
      <div className='grid grid-cols-2 gap-4'>
        <SelectField id='aw-op' label='Operation' value={form.operation} onChange={operation => setForm({ ...form, operation })} options={[{ value: 'credit', label: 'Credit (add)' }, { value: 'debit', label: 'Debit (remove)' }]} />
        <SelectField id='aw-cur' label='Currency' value={form.currency} onChange={currency => setForm({ ...form, currency })} options={(list.length ? list : [...SUPPORTED_CURRENCIES]).map(c => ({ value: c, label: c }))} />
      </div>
      <TextField id='aw-amt' label='Amount' required placeholder='100.00' value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
      <TextAreaField id='aw-desc' label='Reason' required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      <TextField id='aw-tp' label='Transaction password' type='password' hint='Required if your account has one set' value={form.transactionPassword} onChange={e => setForm({ ...form, transactionPassword: e.target.value })} />
    </FormDialog>
  )
}
