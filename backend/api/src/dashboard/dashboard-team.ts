import { UserRole } from '../users/user-role.enum';

export type TeamBidderInput = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
};

export type TeamCountInput = {
  bidderId: number | null;
};

export type TeamBidderRow = TeamBidderInput & {
  applications: number;
  interviews: number;
};

export function canSeeTeamDashboard(role: string) {
  return (
    role === UserRole.ADMIN ||
    role === UserRole.BID_MANAGER ||
    role === UserRole.BIDDER
  );
}

export function rollupTeamBidderPerformance(
  bidders: TeamBidderInput[],
  applications: TeamCountInput[],
  interviews: TeamCountInput[],
): TeamBidderRow[] {
  const apps = new Map<number, number>();
  const ints = new Map<number, number>();
  for (const row of applications) {
    if (row.bidderId == null) {
      continue;
    }
    apps.set(row.bidderId, (apps.get(row.bidderId) ?? 0) + 1);
  }
  for (const row of interviews) {
    if (row.bidderId == null) {
      continue;
    }
    ints.set(row.bidderId, (ints.get(row.bidderId) ?? 0) + 1);
  }
  return bidders.map((bidder) => ({
    ...bidder,
    applications: apps.get(bidder.id) ?? 0,
    interviews: ints.get(bidder.id) ?? 0,
  }));
}

export function assignDenseRanks(values: number[]) {
  const sorted = [...values].sort((a, b) => b - a);
  const rankByValue = new Map<number, number>();
  let rank = 0;
  let previous: number | null = null;
  for (const value of sorted) {
    if (value !== previous) {
      rank += 1;
      previous = value;
      rankByValue.set(value, rank);
    }
  }
  return values.map((value) => rankByValue.get(value) ?? values.length);
}

export function previousWindow(from: Date, to: Date) {
  const duration = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - duration),
    to: new Date(from.getTime()),
  };
}

export function startOfLocalDay(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function eachLocalDay(from: Date, to: Date) {
  const days: Date[] = [];
  const cursor = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  while (cursor < end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function localDayKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function countInRange(timestamps: Date[], from: Date, to: Date) {
  return timestamps.filter(
    (value) => value.getTime() >= from.getTime() && value.getTime() < to.getTime(),
  ).length;
}

export function inTimeRange(value: Date, from: Date, to: Date) {
  return value.getTime() >= from.getTime() && value.getTime() < to.getTime();
}

export function dailyCounts(timestamps: Date[], from: Date, to: Date) {
  const buckets = new Map<string, number>();
  for (const day of eachLocalDay(from, to)) {
    buckets.set(localDayKey(day), 0);
  }
  for (const value of timestamps) {
    const key = localDayKey(value);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  return [...buckets.entries()].map(([date, applications]) => ({
    date,
    applications,
  }));
}
