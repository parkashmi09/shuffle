import { Suspense } from 'react'

import StaffList from '@/views/staff/StaffList'

export const metadata = { title: 'Staff & agents' }

export default function Page() {
  return (
    <Suspense>
      <StaffList />
    </Suspense>
  )
}
