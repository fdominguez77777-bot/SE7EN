export const ActivityType = {
  RESUME: 'RESUME',
  APPLICATION: 'APPLICATION',
  INTERVIEW: 'INTERVIEW',
} as const;

export type ActivityCountRow = {
  resumesGenerated: number
  applications: number
  interviews: number
}

export function snapshotBidderId(assignedBidderId: number | null | undefined) {
  return assignedBidderId ?? null
}

export function emptyCounts(): ActivityCountRow {
  return { resumesGenerated: 0, applications: 0, interviews: 0 }
}

export function addDelta(
  counts: ActivityCountRow,
  type: string,
  delta: number,
): ActivityCountRow {
  if (type === ActivityType.RESUME) {
    return { ...counts, resumesGenerated: counts.resumesGenerated + delta }
  }
  if (type === ActivityType.APPLICATION) {
    return { ...counts, applications: counts.applications + delta }
  }
  if (type === ActivityType.INTERVIEW) {
    return { ...counts, interviews: counts.interviews + delta }
  }
  return counts
}

export function rollupByBidderId(
  events: Array<{ bidderId: number | null; type: string; delta: number }>,
): Map<number, ActivityCountRow> {
  const totals = new Map<number, ActivityCountRow>()
  for (const event of events) {
    if (event.bidderId == null) {
      continue
    }
    const current = totals.get(event.bidderId) ?? emptyCounts()
    totals.set(event.bidderId, addDelta(current, event.type, event.delta))
  }
  return totals
}
