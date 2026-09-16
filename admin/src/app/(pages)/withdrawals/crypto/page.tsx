import { Suspense } from 'react'

import View from '@/views/finance/CryptoWithdrawals'

export const metadata = { title: 'Crypto withdrawals' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
