import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const Money = ({
  value,
  currency,
  signed,
  className
}: {
  value: string | number | null | undefined
  currency?: string | null
  signed?: boolean
  className?: string
}) => {
  const n = value === null || value === undefined ? NaN : Number(value)
  const tone = signed && Number.isFinite(n) ? (n > 0 ? 'text-success' : n < 0 ? 'text-danger' : '') : ''

  return (
    <span className={cn('whitespace-nowrap tabular-nums', tone, className)}>
      {signed && Number.isFinite(n) && n > 0 ? '+' : ''}
      {formatMoney(value)}
      {currency && <span className='text-muted-foreground ml-1 text-[0.9em] font-normal'>{currency}</span>}
    </span>
  )
}

export default Money
