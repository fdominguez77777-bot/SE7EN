'use client'

import { RoleRoute } from '../../../../auth/RoleRoute'
import { MembersPage } from '../../../../views/MembersPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN']}>
      <MembersPage />
    </RoleRoute>
  )
}
