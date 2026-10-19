'use client'

import { useAuth } from '@/auth/AuthContext'
import { Navigate } from '@/lib/navigation'
import { hasAnyMemberRole, hasMemberRole } from '@/ui/roles'
import { DashboardPage } from '@/views/DashboardPage'

export default function Page() {
  const { user } = useAuth()
  if (
    user &&
    hasMemberRole(user, 'CALLER') &&
    !hasAnyMemberRole(user, ['ADMIN', 'BID_MANAGER', 'BIDDER'])
  ) {
    return <Navigate to="/interviews" replace />
  }
  return <DashboardPage />
}
