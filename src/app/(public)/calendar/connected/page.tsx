'use client'

import { Suspense } from 'react'

import { CalendarConnectedPage } from '@/views/CalendarConnectedPage'
import { AppLoadingScreen } from '@/ui/loading/AppLoadingScreen'

export default function Page() {
  return (
    <Suspense fallback={<AppLoadingScreen message="Opening calendar…" />}>
      <CalendarConnectedPage />
    </Suspense>
  )
}
