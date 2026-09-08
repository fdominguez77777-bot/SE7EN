'use client'

import type { ReactNode } from 'react'

import { RoleRoute } from '@/auth/RoleRoute'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleRoute roles={['ADMIN']}>{children}</RoleRoute>
}
