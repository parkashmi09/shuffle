import { Suspense } from 'react'

import PlayersList from '@/views/players/PlayersList'

export const metadata = { title: 'Players' }

export default function Page() {
  return (
    <Suspense>
      <PlayersList />
    </Suspense>
  )
}
