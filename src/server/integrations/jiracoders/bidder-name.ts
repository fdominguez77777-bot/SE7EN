export function normalizeBidderName(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
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

export function countsTowardApplicationTotal(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase() === 'applied';
}

export function countApplicationsByBidderName(
  applications: Array<{ bidderName: string | null | undefined }>,
  bidders: Array<{ id: number; name: string }>,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const application of applications) {
    const bidderId = matchBidderIdByName(application.bidderName, bidders);
    if (bidderId == null) {
      continue;
    }
    counts.set(bidderId, (counts.get(bidderId) ?? 0) + 1);
  }
  return counts;
}
