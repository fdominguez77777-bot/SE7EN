'use client'

import type { ReactNode } from 'react'

import { RoleRoute } from '@/auth/RoleRoute'

export default function BiddersLayout({ children }: { children: ReactNode }) {
  return (
    <RoleRoute roles={['ADMIN', 'BID_MANAGER', 'BIDDER']}>{children}</RoleRoute>
  )
}
