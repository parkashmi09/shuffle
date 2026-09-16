import { Suspense } from 'react'

import View from '@/views/finance/FiatDeposits'

export const metadata = { title: 'Fiat deposits' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
