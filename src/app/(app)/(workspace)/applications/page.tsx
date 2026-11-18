'use client'

import { Suspense } from 'react'

import { ApplicationsPage } from '@/views/ApplicationsPage'
import { PageSkeleton } from '@/ui/loading/page-skeletons'

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <ApplicationsPage />
    </Suspense>
  )
}
