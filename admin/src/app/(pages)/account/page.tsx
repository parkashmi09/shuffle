import { Suspense } from 'react'

import MyAccount from '@/views/account/MyAccount'

export const metadata = { title: 'My account' }

export default function Page() {
  return (
    <Suspense>
      <MyAccount />
    </Suspense>
  )
}
