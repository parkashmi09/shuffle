import { Suspense } from 'react'

import View from '@/views/casino/InHouse'

export const metadata = { title: 'In-house games' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
