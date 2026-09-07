'use client'

import { RoleRoute } from '../../../auth/RoleRoute'
import { ReportsPage } from '../../../views/ReportsPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
      <ReportsPage />
    </RoleRoute>
  )
}
