import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'

import type { Role } from '../api/types'
import { homePathForRole, useAuth } from './AuthContext'

export function RoleRoute({
  roles,
  children,
}: {
  roles: Role[]
  children: ReactNode
}) {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }
  return <>{children}</>
}
