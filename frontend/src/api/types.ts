export type Role = 'ADMIN' | 'BID_MANAGER' | 'BIDDER'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  bidderProfileId: number | null
  created_at: string
}

export type AuthResponse = {
  accessToken: string
  user: User
}

export type Project = {
  id: number
  title: string
  description: string | null
  status: string
  opensAt: string | null
  closesAt: string | null
  awardedSubmissionId: number | null
  createdById: number
  created_at: string
  updated_at: string
}

export type BidderProfile = {
  id: number
  name: string
  legalName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  address: string | null
  status: string
  created_at: string
  updated_at: string
}

export type BidInvitation = {
  id: number
  projectId: number
  projectTitle: string | null
  bidderProfileId: number
  bidderName: string | null
  status: string
  invitedById: number
  created_at: string
  updated_at: string
}

export type BidSubmission = {
  id: number
  projectId: number
  projectTitle: string | null
  bidderProfileId: number
  bidderName: string | null
  invitationId: number
  amount: number
  currency: string
  notes: string | null
  status: string
  createdById: number
  created_at: string
  updated_at: string
}

export type DashboardSummary = {
  role: Role
  openProjects?: number
  submissionsToReview?: number
  invitationsSent?: number
  pendingInvitations?: number
  mySubmissions?: number
  bidderProfileId?: number | null
}
