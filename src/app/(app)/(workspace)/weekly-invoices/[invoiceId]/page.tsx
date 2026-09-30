'use client'

import { useAuth } from '@/auth/AuthContext'
import { BidderInvoicesPage, WeeklyInvoicesPage } from '@/views/WeeklyInvoicesPage'

export default function Page() {
  const { user } = useAuth()
  if (user?.role === 'BIDDER') {
    return <BidderInvoicesPage />
  }
  return <WeeklyInvoicesPage />
}
