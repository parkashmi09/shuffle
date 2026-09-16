import { Suspense } from 'react'

import View from '@/views/sports/SportsBets'

export const metadata = { title: 'Sports bets' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
