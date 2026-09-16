import { Suspense } from 'react'

import View from '@/views/sports/Catalogue'

export const metadata = { title: 'Sports catalogue' }

export default function Page() {
  return (
    <Suspense>
      <View />
    </Suspense>
  )
}
