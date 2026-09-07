'use client'

import { RoleRoute } from '../../../../auth/RoleRoute'
import { CalendarIntegrationsPage } from '../../../../views/CalendarIntegrationsPage'

export default function Page() {
  return (
    <RoleRoute roles={['ADMIN']}>
      <CalendarIntegrationsPage />
    </RoleRoute>
  )
}
