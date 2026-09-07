import type { ReactNode } from 'react'

import { Navigate } from '../routing'

import { useAuth } from './AuthContext'
import { AppLoadingScreen } from '../ui/loading/AppLoadingScreen'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') {
    return <AppLoadingScreen message="Verifying access…" />
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}
