'use client'

import { useAuth } from '@/auth/AuthContext'
import { Navigate } from '@/lib/navigation'
import { DashboardPage } from '@/views/DashboardPage'

export default function Page() {
  const { user } = useAuth()
  if (user?.role === 'CALLER') {
    return <Navigate to="/interviews" replace />
  }
  return <DashboardPage />
}
