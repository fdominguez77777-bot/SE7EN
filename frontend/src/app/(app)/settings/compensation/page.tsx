'use client'

import { RoleRoute } from '../../../../auth/RoleRoute'
import { CompensationSettingsPage } from '../../../../views/CompensationSettingsPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN']}>
      <CompensationSettingsPage />
    </RoleRoute>
  )
}
