'use client'

import { RoleRoute } from '../../../auth/RoleRoute'
import { MyProfilePage } from '../../../views/MyProfilePage'

export default function Page() {
  return (
    <RoleRoute roles={['BIDDER']}>
      <MyProfilePage />
    </RoleRoute>
  )
}
