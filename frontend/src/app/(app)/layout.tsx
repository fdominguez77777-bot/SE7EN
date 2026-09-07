'use client'

import type { ReactNode } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { DashboardLayout } from '../../layouts/DashboardLayout'
import { Navigate } from '../../routing'
import { AppLoadingScreen } from '../../ui/loading/AppLoadingScreen'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, workspaceError, message, retry } = useAuth()

  if (workspaceError) {
    return <AppLoadingScreen error onRetry={retry} />
  }
  if (status === 'loading') {
    return <AppLoadingScreen message={message} />
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }
  return <DashboardLayout>{children}</DashboardLayout>
}
