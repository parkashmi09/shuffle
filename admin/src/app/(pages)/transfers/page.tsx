import { Suspense } from 'react'

import View from '@/views/finance/Transfers'

export const metadata = { title: 'Transfers' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
