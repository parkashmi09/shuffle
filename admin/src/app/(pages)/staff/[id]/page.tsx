import { Suspense } from 'react'

import StaffDetail from '@/views/staff/StaffDetail'

export const metadata = { title: 'Staff member' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <Suspense>
      <StaffDetail id={id} />
    </Suspense>
  )
}
