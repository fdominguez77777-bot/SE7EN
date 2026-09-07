'use client'

import { Suspense } from 'react'

import { RoleRoute } from '../../../auth/RoleRoute'
import { ApplicationsPage } from '../../../views/ApplicationsPage'
import { AppLoadingScreen } from '../../../ui/loading/AppLoadingScreen'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER', 'BIDDER']}>
      <Suspense fallback={<AppLoadingScreen message="Loading applications…" />}>
        <ApplicationsPage />
      </Suspense>
    </RoleRoute>
  )
}
