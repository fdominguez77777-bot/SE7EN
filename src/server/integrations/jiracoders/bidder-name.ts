export function normalizeBidderName(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeBidderEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function matchBidderIdByName(
  name: string | null | undefined,
  bidders: Array<{ id: number; name: string }>,
): number | null {
  const key = normalizeBidderName(name);
  if (!key) {
    return null;
  }
  const matches = bidders
    .filter((bidder) => normalizeBidderName(bidder.name) === key)
    .sort((left, right) => left.id - right.id);
  return matches[0]?.id ?? null;
}

export function matchBidderIdByEmail(
  email: string | null | undefined,
  bidders: Array<{ id: number; email: string }>,
): number | null {
  const key = normalizeBidderEmail(email);
  if (!key) {
    return null;
  }
  const matches = bidders
    .filter((bidder) => normalizeBidderEmail(bidder.email) === key)
    .sort((left, right) => left.id - right.id);
  return matches[0]?.id ?? null;
}

/** Prefer the calendar assignment, then the connected Gmail. */
export function creditInterviewBidderId(
  event: { bidderId?: number | null; email?: string | null },
  people: Array<{ id: number; email: string }>,
): number | null {
  const assigned = event.bidderId;
  if (assigned != null && people.some((row) => row.id === assigned)) {
    return assigned;
  }
  return matchBidderIdByEmail(event.email, people);
}

export const JIRA_STATS_TIME_ZONE = 'America/Chicago';

/** JiraCoders bidder stats require MM/DD/YYYY with leading zeros. */
export function formatJiraStatsDate(
  value: Date,
  timeZone = JIRA_STATS_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('month')}/${pick('day')}/${pick('year')}`;
}

/** Convert a half-open [from, to) window into inclusive Jira stats dates. */
export function jiraStatsRange(from?: Date, to?: Date) {
  return {
    fromDate: from ? formatJiraStatsDate(from) : undefined,
    toDate: to ? formatJiraStatsDate(new Date(to.getTime() - 1)) : undefined,
  };
}

export function countsFromBidderStats(
  stats: Array<{ name?: string | null; applicationsCount?: number | null }>,
  bidders: Array<{ id: number; name: string }>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const bidder of bidders) {
    counts.set(bidder.id, 0);
  }
  for (const row of stats) {
    const bidderId = matchBidderIdByName(row.name ?? null, bidders);
    if (bidderId == null) {
      continue;
    }
    counts.set(bidderId, Number(row.applicationsCount) || 0);
  }
  return counts;
}

export function sumCountMap(counts: Map<number, number>) {
  let total = 0;
  for (const value of counts.values()) {
    total += value;
  }
  return total;
}

export function countsTowardApplicationTotal(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase() === 'applied';
}

export function countApplicationsByBidderName(
  applications: Array<{
    bidderName: string | null | undefined;
    status?: string | null;
  }>,
  bidders: Array<{ id: number; name: string }>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const application of applications) {
    if (
      application.status != null &&
      !countsTowardApplicationTotal(application.status)
    ) {
      continue;
    }
    const bidderId = matchBidderIdByName(application.bidderName, bidders);
    if (bidderId == null) {
      continue;
    }
    counts.set(bidderId, (counts.get(bidderId) ?? 0) + 1);
  }
  return counts;
}
