import { Suspense } from 'react'

import View from '@/views/finance/Wallets'

export const metadata = { title: 'Wallets' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
