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

export type WorkExperience = {
  id: number
  candidateProfileId: number
  companyName: string
  industry: string | null
  city: string | null
  state: string | null
  startDate: string
  endDate: string | null
  currentlyWorksHere: boolean
  sortOrder: number
}

export type Education = {
  id: number
  candidateProfileId: number
  institutionName: string
  degree: string | null
  fromDate: string | null
  toDate: string | null
  sortOrder: number
}

export type CandidateProfile = {
  id: number
  profileName: string
  firstName: string | null
  middleName: string | null
  lastName: string | null
  email: string | null
  phoneNumber: string | null
  gender: string | null
  dateOfBirth: string | null
  streetAddress: string | null
  city: string | null
  stateRegion: string | null
  zipPostalCode: string | null
  linkedinUrl: string | null
  githubUrl: string | null
  portfolioUrl: string | null
  raceEthnicity: string | null
  veteranStatus: string | null
  disabilityStatus: string | null
  status: string
  assignedUser: { id: number; name: string; email: string } | null
  experiences: WorkExperience[]
  educations: Education[]
  created_at: string
  updated_at: string
}

export type BidderProfile = CandidateProfile

export type ActivityRow = {
  candidateProfileId: number
  profileName: string
  resumesGenerated: number
  applications: number
  interviews: number
}

export type DashboardSummary = {
  role: Role
  from: string
  to: string
  bidderProfileId: number | null
  byCandidate: ActivityRow[]
}

export type Interview = {
  id: number
  candidateProfileId: number
  profileName: string | null
  company: string
  jobTitle: string
  startsAt: string
  round: string | null
  source: string | null
  result: string | null
  notes: string | null
  createdById: number
  created_at: string
  updated_at: string
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
