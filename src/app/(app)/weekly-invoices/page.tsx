'use client'

import { RoleRoute } from '../../../auth/RoleRoute'
import { WeeklyInvoicesPage } from '../../../views/WeeklyInvoicesPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
      <WeeklyInvoicesPage />
    </RoleRoute>
  )
}
