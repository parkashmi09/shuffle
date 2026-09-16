import { Suspense } from 'react'

import View from '@/views/sports/Results'

export const metadata = { title: 'Sports results' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
