export function normalizeBidderName(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeBidderEmail(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

/** Small edit distance for near-miss spellings (Maani vs Manni). */
export function bidderNameDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }
  const a = left;
  const b = right;
  if (Math.abs(a.length - b.length) > 2) {
    return Math.max(a.length, b.length);
  }
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0),
  );
  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function maxFuzzyDistance(name: string) {
  if (name.length >= 6) {
    return 2;
  }
  if (name.length >= 4) {
    return 1;
  }
  return 0;
}

export function matchBidderIdByName(
  name: string | null | undefined,
  bidders: Array<{ id: number; name: string }>,
): number | null {
  const key = normalizeBidderName(name);
  if (!key) {
    return null;
  }
  const exact = bidders
    .filter((bidder) => normalizeBidderName(bidder.name) === key)
    .sort((left, right) => left.id - right.id);
  if (exact.length > 0) {
    return exact[0]?.id ?? null;
  }

  const fuzzyLimit = maxFuzzyDistance(key);
  if (fuzzyLimit <= 0) {
    return null;
  }
  const near = bidders
    .map((bidder) => ({
      id: bidder.id,
      distance: bidderNameDistance(key, normalizeBidderName(bidder.name)),
    }))
    .filter((row) => row.distance > 0 && row.distance <= fuzzyLimit)
    .sort(
      (left, right) =>
        left.distance - right.distance || left.id - right.id,
    );
  if (near.length === 0) {
    return null;
  }
  // Only credit when one bidder is clearly closest (no tie at best distance).
  if (near.length > 1 && near[0].distance === near[1].distance) {
    return null;
  }
  return near[0]?.id ?? null;
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

/** Applied and draft rows both count toward dashboard / ranking totals. */
export function countsTowardApplicationTotal(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized === 'applied' || normalized === 'draft';
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
