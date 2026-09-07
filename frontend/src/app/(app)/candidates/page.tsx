'use client'

import { RoleRoute } from '../../../auth/RoleRoute'
import { CandidatesPage } from '../../../views/CandidatesPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
      <CandidatesPage />
    </RoleRoute>
  )
}
