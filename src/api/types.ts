export type Role = 'ADMIN' | 'BID_MANAGER' | 'BIDDER'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  isActive: boolean
  avatarUrl: string | null
  created_at: string
}

export type MemberDetail = User & {
  assignedProfileCount: number
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
  assignedBidderId: number | null
  assignedUser: { id: number; name: string; email: string; avatarUrl?: string | null } | null
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

export type ActivityBidderRow = {
  bidderId: number
  bidderName: string | null
  bidderEmail: string | null
  resumesGenerated: number
  applications: number
  interviews: number
}

export type ActivityEvent = {
  id: number
  candidateProfileId: number | null
  profileName: string | null
  bidderId: number | null
  bidderName: string | null
  bidderEmail: string | null
  type: string
  delta: number
  source: string
  note: string | null
  occurredAt: string
}

export type DashboardTeamBidder = {
  id: number
  name: string
  email: string
  isActive: boolean
  applications: number
  interviews: number
  todayApplications: number
  todayInterviews: number
  weekApplications: number
  weekInterviews: number
}

export type DashboardDayPoint = {
  date: string
  applications: number
  interviews: number
}

export type DashboardActivityItem = {
  id: string
  at: string
  title: string
  detail: string
}

export type DashboardSummary = {
  role: Role
  from: string
  to: string
  byCandidate: ActivityRow[]
  activeBidderCount: number
  bidderCount: number
  applications: number
  interviews: number
  previousApplications: number
  previousInterviews: number
  todayApplications: number
  todayInterviews: number
  weekApplications: number
  weekInterviews: number
  daily: DashboardDayPoint[]
  weekDaily: DashboardDayPoint[]
  bidders: DashboardTeamBidder[]
  recent: DashboardActivityItem[]
}

export type Interview = {
  id: number
  candidateProfileId: number
  profileName: string | null
  jobApplicationId: number | null
  applicationCompany: string | null
  applicationJobTitle: string | null
  bidderId: number | null
  bidderName: string | null
  company: string
  jobTitle: string
  startsAt: string
  round: string | null
  source: string | null
  status: string
  method: string | null
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

export type JobApplication = {
  id: number
  candidateProfileId: number
  profileName: string | null
  candidateFullName: string | null
  bidderId: number | null
  bidderName: string | null
  bidderEmail: string | null
  createdByUserId: number | null
  companyName: string
  jobTitle: string
  location: string | null
  jobUrl: string | null
  source: string
  sourceExternalId: string | null
  talynApplicationId: string | null
  appliedAt: string
  status: string
  notes: string | null
  interviewCount?: number
  interviews?: ApplicationInterview[]
  jobDescriptionText?: string | null
  resumeText?: string | null
  created_at: string
  updated_at: string
}

export type ApplicationInterview = {
  id: number
  round: string | null
  startsAt: string
  method: string | null
  status: string
  result: string | null
  notes?: string | null
}

export type ApplicationTableRow = {
  id: number
  companyName: string
  jobTitle: string
  source: string
  status: string
  outcome: string | null
  appliedAt: string
  jobUrl: string | null
  candidateFullName: string | null
  candidateAvatarUrl: string | null
  profileName: string | null
  bidderId: number | null
  bidderName: string | null
  notes?: string | null
  jobDescriptionText?: string | null
  resumeUrl?: string | null
  resumeText?: string | null
  salary?: string | null
  expYears?: string | null
  profileId?: number | null
  interviewCount?: number
  interviews?: Array<{
    id: number
    summary: string | null
    startsAt: string | null
    status: string | null
  }>
  statusHistory?: Array<{
    id: number
    status: string | null
    outcome: string | null
    changedAt: string | null
    changedBy: string | null
  }>
  profileWorkHistory?: Array<{
    companyName: string | null
    startDate: string | null
    endDate: string | null
    isPresent: boolean
  }>
  profileEducation?: Array<{
    degree: string | null
    institutionName: string | null
    startDate: string | null
    endDate: string | null
    isPresent: boolean
  }>
}

export type ApplicationTablePage = {
  items: ApplicationTableRow[]
  count: number | null
  page: number
  limit: number
}

export type ApplicationBidderOption = {
  id: number
  name: string
  username: string | null
  isActive: boolean
  applicationsCount: number
}

export type BidderCompensationRate = {
  id: number
  applicationRate: string
  interviewRate: string
  effectiveFrom: string
  effectiveTo: string | null
  notes: string | null
}

export type IndividualBidderRate = {
  id: number
  bidderId: number
  applicationRate: string
  interviewRate: string
  effectiveFrom: string
  effectiveTo: string | null
  notes: string | null
}

export type IndividualBidderRateConfig = {
  bidder: User
  source: 'individual' | 'default'
  resolved: {
    applicationRate: string
    interviewRate: string
    source: 'individual' | 'default'
  } | null
  current: IndividualBidderRate | null
  history: IndividualBidderRate[]
}

export type ManagerSalaryRow = {
  manager: User
  current: {
    id: number
    weeklySalary: string
    effectiveFrom: string
    effectiveTo: string | null
  } | null
}

export type BidderWeeklyPayment = {
  id: number
  bidderId: number
  bidderName: string | null
  bidderEmail: string | null
  applicationCount: number
  interviewCount: number
  applicationRate: string
  interviewRate: string
  applicationPayAmount: string
  interviewPayAmount: string
  totalAmount: string
  status: string
}

export type ManagerWeeklyPayment = {
  id: number
  managerId: number
  managerName: string | null
  managerEmail: string | null
  weeklySalaryRate: string
  totalAmount: string
  status: string
}

export type CompensationWeek = {
  from: string
  to: string
  bidders: BidderWeeklyPayment[]
  managers: ManagerWeeklyPayment[]
  summary: {
    bidderPayTotal: string
    managerSalaryTotal: string
    payrollTotal: string
  }
}

export type DailySubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED'

export type DailySubmissionRow = {
  id: number
  bidderId: number
  bidderName: string
  bidderEmail: string
  bidderRole?: Role
  bidderAvatarUrl?: string | null
  assignedProfileCount: number
  systemApplicationCount: number
  gmailConfirmedApplicationCount: number | null
  applicationDifference: number | null
  systemInterviewCount: number
  verifiedInterviewCount: number | null
  interviewDifference: number | null
  notes: string | null
}

export type DailySubmissionDetail = {
  id: number
  reportingDate: string
  status: DailySubmissionStatus
  manager: { id: number; name: string; email: string; avatarUrl?: string | null } | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewedByUser: { id: number; name: string } | null
  updated_at: string
  created_at: string
  unread?: boolean
  rows: DailySubmissionRow[]
}

export type DailySubmissionListItem = {
  id: number
  reportingDate: string
  status: DailySubmissionStatus
  manager: { id: number; name: string; email: string; avatarUrl?: string | null } | null
  submittedAt: string | null
  reviewedAt: string | null
  updated_at: string
  systemApplications: number
  gmailConfirmed: number
  applicationDifference: number
  systemInterviews: number
  verifiedInterviews: number
  interviewDifference: number
  bidderCount: number
  unread: boolean
}

export type WeeklyInvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'APPROVED'

export type WeeklyInvoiceCoverageStatus =
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'DRAFT'
  | 'MISSING'
  | 'NO_ACTIVITY'
  | 'WEEKEND_OFF'

export type WeeklyInvoiceDailyBreakdown = {
  reportingDate: string
  applicationCount: number | null
  interviewCount: number | null
  included: boolean
}

export type WeeklyInvoiceRow = {
  id: number
  bidderId: number
  bidderName: string
  bidderEmail: string
  bidderAvatarUrl?: string | null
  assignedProfileCount: number
  isActive: boolean
  defaultApplicationCount: number
  invoiceApplicationCount: number
  applicationDifference: number
  configuredApplicationRate: string
  invoiceApplicationRate: string
  defaultInterviewCount: number
  invoiceInterviewCount: number
  interviewDifference: number
  configuredInterviewRate: string
  invoiceInterviewRate: string
  applicationAmount: string
  interviewAmount: string
  totalAmount: string
  rateSource: string
  countAdjustmentReason: string | null
  rateAdjustmentReason: string | null
  dailyBreakdown: WeeklyInvoiceDailyBreakdown[]
}

export type WeeklyInvoiceDetail = {
  id: number
  periodStart: string
  periodEnd: string
  status: WeeklyInvoiceStatus
  managerNotes: string | null
  noActivityDates: string[]
  missingDayAcknowledgement: string | null
  manager: { id: number; name: string; email: string; avatarUrl?: string | null } | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewedByUser: { id: number; name: string } | null
  approvedAt: string | null
  approvedByUser: { id: number; name: string } | null
  updated_at: string
  created_at: string
  summary: {
    defaultApplications: number
    defaultInterviews: number
    invoiceApplications: number
    invoiceInterviews: number
    activeBidders: number
    applicationAmount: string
    interviewAmount: string
    totalAmount: string
  }
  coverage: Array<{
    reportingDate: string
    dailySubmissionId: number | null
    status: WeeklyInvoiceCoverageStatus
  }>
  rows: WeeklyInvoiceRow[]
}

export type WeeklyInvoiceListItem = {
  id: number
  periodStart: string
  periodEnd: string
  status: WeeklyInvoiceStatus
  manager: { id: number; name: string; email: string; avatarUrl?: string | null } | null
  submittedAt: string | null
  reviewedAt: string | null
  approvedAt: string | null
  applications: number
  interviews: number
  totalAmount: string
  bidderCount: number
}

export type CalendarAccount = {
  id: number
  provider: string
  email: string
  displayName: string
  initials: string
  color: string
  assignedBidderId: number | null
  assignedBidderName: string | null
}

export type CalendarBidder = {
  id: number
  name: string
  email: string
  role: string
  calendarEmail: string | null
  calendarEmails: string[]
  accountId: number | null
  accountIds: number[]
  color: string
  initials: string
}

export type CalendarGuest = {
  name: string
  email: string
  status: 'accepted' | 'declined' | 'tentative' | 'needsAction'
}

export type CalendarEvent = {
  id: string
  accountId: number
  bidderId: number | null
  title: string
  start: string
  end: string | null
  allDay: boolean
  color: string
  email: string
  initials: string
  location: string | null
  description: string | null
  joinUrl: string | null
  htmlLink: string | null
  organizerName: string | null
  organizerEmail: string | null
  guests: CalendarGuest[]
}

export type CalendarConnectLink = {
  url: string
  expiresAt: string
  provider: string
}


