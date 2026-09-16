'use client'

import { useState } from 'react'

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import Can from '@/components/shared/Can'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable, { type Column } from '@/components/shared/DataTable'
import FormDialog from '@/components/shared/FormDialog'
import { SwitchField, TextField } from '@/components/shared/FormField'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi, useApiMutation } from '@/hooks/use-api'
import { api } from '@/lib/api/client'

/**
 * The payment destinations a player is shown when they deposit — one list per
 * currency. Writes are multipart because a row may carry a QR image.
 */
type BankRow = {
  id: number
  coin_type?: string
  bankName?: string | null
  accountNumber?: string | null
  ifscCode?: string | null
  accountHolderName?: string | null
  upiId?: string | null
  isActive?: boolean
  qrImage?: string | null
  createdAt?: string
}

const CURRENCIES = ['INR', 'PKR', 'BDT', 'NPR', 'AED', 'MVR', 'EUR', 'USDT']

const emptyForm = { bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', upiId: '', isActive: true }

const DetailForm = ({ coin, row, onDone }: { coin: string; row?: BankRow; onDone?: () => void }) => {
  const [form, setForm] = useState({
    bankName: row?.bankName ?? '',
    accountNumber: row?.accountNumber ?? '',
    ifscCode: row?.ifscCode ?? '',
    accountHolderName: row?.accountHolderName ?? '',
    upiId: row?.upiId ?? '',
    isActive: row?.isActive ?? true
  })
  const [file, setFile] = useState<File | null>(null)

  const save = useApiMutation({
    fn: () => {
      // Multipart even without a file: the backend parses these routes with multer.
      const fd = new FormData()

      for (const [k, v] of Object.entries(form)) if (v !== '' && v !== undefined) fd.set(k, String(v))
      if (file) fd.set('qr_image', file)

      return row
        ? api.upload(`admin/user/bank-details/${coin}/${row.id}`, fd, 'PUT')
        : api.upload(`admin/user/bank-details/${coin}`, fd, 'POST')
    },
    invalidate: [['api', `admin/user/bank-details/${coin}`]],
    success: row ? 'Destination updated' : 'Destination added',
    onSuccess: () => onDone?.()
  })

  return (
    <FormDialog
      trigger={
        row ? (
          <Button variant='ghost' size='icon-sm' aria-label='Edit'>
            <PencilIcon />
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Add destination
          </Button>
        )
      }
      title={row ? `Edit ${coin} destination` : `New ${coin} destination`}
      description='Either an account number or a UPI id is required. The QR image is optional and replaces the stored one.'
      submitLabel={row ? 'Save' : 'Add'}
      onSubmit={() => save.mutateAsync()}
    >
      <TextField id='bd-holder' label='Account holder' value={form.accountHolderName} onChange={e => setForm({ ...form, accountHolderName: e.target.value })} />
      <div className='grid grid-cols-2 gap-4'>
        <TextField id='bd-bank' label='Bank name' value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} />
        <TextField id='bd-ifsc' label='IFSC / SWIFT' value={form.ifscCode} onChange={e => setForm({ ...form, ifscCode: e.target.value })} />
      </div>
      <TextField id='bd-acct' label='Account number' value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} />
      <TextField id='bd-upi' label='UPI id' value={form.upiId} onChange={e => setForm({ ...form, upiId: e.target.value })} />
      <div className='grid gap-2'>
        <label htmlFor='bd-qr' className='text-sm font-medium'>
          QR image (PNG or JPEG, max 2 MB)
        </label>
        <input id='bd-qr' type='file' accept='image/png,image/jpeg' className='text-sm' onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <SwitchField id='bd-active' label='Shown to players' checked={form.isActive} onChange={isActive => setForm({ ...form, isActive })} />
    </FormDialog>
  )
}

const BankDetails = () => {
  const [coin, setCoin] = useState('INR')
  const list = useApi<BankRow[]>(`admin/user/bank-details/${coin}`, undefined, { retry: false })
  const remove = useApiMutation({
    fn: (id: number) => api.delete(`admin/user/bank-details/${coin}/${id}`),
    invalidate: [['api', `admin/user/bank-details/${coin}`]],
    success: 'Destination deactivated'
  })

  const columns: Column<BankRow>[] = [
    { key: 'holder', header: 'Account holder', cell: r => <span className='font-medium'>{r.accountHolderName ?? '—'}</span> },
    { key: 'bank', header: 'Bank', cell: r => <span>{r.bankName ?? '—'}{r.ifscCode ? <span className='text-muted-foreground'> · {r.ifscCode}</span> : null}</span> },
    { key: 'acct', header: 'Account', cell: r => <span className='font-mono text-xs'>{r.accountNumber ?? '—'}</span> },
    { key: 'upi', header: 'UPI', cell: r => <span className='font-mono text-xs'>{r.upiId ?? '—'}</span> },
    { key: 'active', header: 'Status', cell: r => <StatusBadge value={r.isActive === false ? 'inactive' : 'active'} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: r => (
        <Can permission='config:write'>
          <span className='flex justify-end gap-1'>
            <DetailForm coin={coin} row={r} />
            <ConfirmDialog
              trigger={
                <Button variant='ghost' size='icon-sm' aria-label='Deactivate'>
                  <Trash2Icon />
                </Button>
              }
              title='Deactivate this destination?'
              description='Players will stop seeing it. The row is kept for the deposits already sent to it.'
              confirmLabel='Deactivate'
              destructive
              onConfirm={() => remove.mutateAsync(r.id)}
            />
          </span>
        </Can>
      )
    }
  ]

  return (
    <div>
      <PageHeader
        title='Bank details'
        description='Where players send fiat deposits, one list per currency. Only active rows are offered at the cashier.'
        actions={
          <>
            <Select value={coin} onValueChange={v => v && setCoin(v)}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Can permission='config:write'>
              <DetailForm coin={coin} />
            </Can>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={list.data}
        rowKey={r => r.id}
        loading={list.isLoading}
        fetching={list.isFetching}
        error={list.error}
        emptyMessage={`No ${coin} destination configured yet.`}
      />
    </div>
  )
}

export default BankDetails
