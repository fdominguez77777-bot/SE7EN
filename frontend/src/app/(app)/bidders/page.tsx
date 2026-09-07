'use client'

import { RoleRoute } from '../../../auth/RoleRoute'
import { BiddersPage } from '../../../views/BiddersPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER']}>
      <BiddersPage />
    </RoleRoute>
  )
}
