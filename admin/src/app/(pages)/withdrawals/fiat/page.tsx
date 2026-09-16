import { Suspense } from 'react'

import View from '@/views/finance/FiatWithdrawals'

export const metadata = { title: 'Fiat withdrawals' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
