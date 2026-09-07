'use client'

import { RoleRoute } from '../../../auth/RoleRoute'
import { InterviewsPage } from '../../../views/InterviewsPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER', 'BIDDER']}>
      <InterviewsPage />
    </RoleRoute>
  )
}
