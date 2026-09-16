import { Suspense } from 'react'

import View from '@/views/sports/Settlement'

export const metadata = { title: 'Sports settlement' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
