'use client'

import { RoleRoute } from '../../../../auth/RoleRoute'
import { DailySubmissionsPage } from '../../../../views/DailySubmissionsPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
      <DailySubmissionsPage />
    </RoleRoute>
  )
}
