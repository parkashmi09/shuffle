import type { ReactNode } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
  className?: string
}

/**
 * One number, with the label above it and the icon kept quiet.
 *
 * The icon is a hint at what the number counts, not a thing to look at, so it
 * sits in a muted chip rather than an accent one: on a screen of six tiles, six
 * indigo squares read as six buttons. The accent is spent on what an operator
 * can act on.
 */
const StatCard = ({ label, value, hint, icon, loading, className }: Props) => (
  <Card className={cn('gap-0 py-5 shadow-none', className)}>
    <CardContent className='flex items-start justify-between gap-3 px-5'>
      <div className='min-w-0'>
        <p className='text-muted-foreground text-xs font-medium'>{label}</p>
        {loading ? (
          <Skeleton className='mt-2 h-8 w-24' />
        ) : (
          <p className='mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums'>{value}</p>
        )}
        {hint && <p className='text-muted-foreground mt-1 text-xs'>{hint}</p>}
      </div>
      {icon && <div className='bg-muted text-muted-foreground rounded-lg p-2 [&_svg]:size-4.5'>{icon}</div>}
    </CardContent>
  </Card>
)

export default StatCard
