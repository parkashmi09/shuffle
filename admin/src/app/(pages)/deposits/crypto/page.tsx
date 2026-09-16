import { Suspense } from 'react'

import View from '@/views/finance/CryptoDeposits'

export const metadata = { title: 'Crypto deposits' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
