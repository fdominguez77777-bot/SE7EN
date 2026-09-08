'use client'

import { Navigate } from '@/lib/navigation'
import type { ReactNode } from 'react'

import type { Role } from '../api/types'
import { homePathForRole, useAuth } from './AuthContext'
import { AppLoadingScreen } from '../ui/loading/AppLoadingScreen'

export function RoleRoute({
  roles,
  children,
}: {
  roles: Role[]
  children: ReactNode
}) {
  const { status, user } = useAuth()
  if (status === 'loading') {
    return <AppLoadingScreen message="Verifying access…" />
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }
  return <>{children}</>
}
