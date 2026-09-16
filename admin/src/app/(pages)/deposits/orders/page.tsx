import { Suspense } from 'react'

import View from '@/views/finance/PaymentOrders'

export const metadata = { title: 'Payment orders' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
