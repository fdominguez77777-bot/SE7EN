'use client'

import { Suspense } from 'react'

import { ApplicationsPage } from '@/views/ApplicationsPage'
import { AppLoadingScreen } from '@/ui/loading/AppLoadingScreen'

export default function Page() {
  return (
    <Suspense fallback={<AppLoadingScreen message="Loading applications…" />}>
      <ApplicationsPage />
    </Suspense>
  )
}
