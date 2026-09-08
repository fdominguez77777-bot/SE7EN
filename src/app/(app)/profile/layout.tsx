'use client'

import type { ReactNode } from 'react'

import { RoleRoute } from '@/auth/RoleRoute'

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <RoleRoute roles={['BIDDER']}>{children}</RoleRoute>
}
