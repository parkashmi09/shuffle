import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

const PageHeader = ({ title, description, actions }: Props) => (
  <div className='mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3'>
    <div className='min-w-0'>
      <h1 className='text-foreground text-xl font-semibold tracking-tight'>{title}</h1>
      {description && <p className='text-muted-foreground mt-1.5 max-w-prose text-sm'>{description}</p>}
    </div>
    {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
  </div>
)

export default PageHeader
