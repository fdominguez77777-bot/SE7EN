import type { ActivityBidderRow, CandidateProfile, User } from '../api/types'

export type BidderReportRow = {
  bidder: User
  candidates: CandidateProfile[]
  resumes: number
  applications: number
  interviews: number
}

export function candidateFullName(
  profile: Pick<CandidateProfile, 'firstName' | 'middleName' | 'lastName'>,
) {
  return [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(' ')
}

export function profilesForBidder(
  bidder: User,
  profiles: CandidateProfile[],
) {
  return profiles.filter((profile) => profile.assignedUser?.id === bidder.id)
}

export function buildBidderReport(
  bidders: User[],
  profiles: CandidateProfile[],
  byBidder: ActivityBidderRow[],
  options?: { includeIdle?: boolean },
): BidderReportRow[] {
  const activityMap = new Map(
    byBidder.map((row) => [row.bidderId, row] as const),
  )
  const rows = bidders.map((bidder) => {
    const candidates = profilesForBidder(bidder, profiles)
    const activity = activityMap.get(bidder.id)
    return {
      bidder,
      candidates,
      resumes: activity?.resumesGenerated ?? 0,
      applications: activity?.applications ?? 0,
      interviews: activity?.interviews ?? 0,
    }
  })
  if (options?.includeIdle === false) {
    return rows.filter(
      (row) =>
        row.candidates.length > 0 ||
        row.applications !== 0 ||
        row.interviews !== 0 ||
        row.resumes !== 0,
    )
  }
  return rows
}

export function reportTotals(rows: BidderReportRow[]) {
  return rows.reduce(
    (acc, row) => ({
      bidders: acc.bidders + 1,
      candidates: acc.candidates + row.candidates.length,
      applications: acc.applications + row.applications,
      interviews: acc.interviews + row.interviews,
      resumes: acc.resumes + row.resumes,
    }),
    { bidders: 0, candidates: 0, applications: 0, interviews: 0, resumes: 0 },
  )
}
