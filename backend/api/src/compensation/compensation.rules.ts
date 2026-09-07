import { InterviewStatus } from '../interviews/interview.rules';

export const PaymentStatus = {
  DRAFT: 'DRAFT',
  REVIEWED: 'REVIEWED',
  PAID: 'PAID',
} as const;

export const PAYABLE_INTERVIEW_STATUSES = [
  InterviewStatus.SCHEDULED,
  InterviewStatus.COMPLETED,
] as const;

export function isPayableInterviewStatus(status: string | null | undefined) {
  return (
    status === InterviewStatus.SCHEDULED || status === InterviewStatus.COMPLETED
  );
}

export function countsPayableInterview(params: {
  bidderId: number | null | undefined;
  creditedBidderId: number;
  startsAt: Date | string;
  status: string | null | undefined;
  from: Date;
  to: Date;
}) {
  if (params.bidderId !== params.creditedBidderId) {
    return false;
  }
  if (!isPayableInterviewStatus(params.status)) {
    return false;
  }
  const start = new Date(params.startsAt).getTime();
  return start >= params.from.getTime() && start < params.to.getTime();
}

export function countPayableInterviews(
  rows: Array<{
    bidderId: number | null;
    startsAt: Date | string;
    status: string | null;
  }>,
  creditedBidderId: number,
  from: Date,
  to: Date,
) {
  return rows.filter((row) =>
    countsPayableInterview({
      bidderId: row.bidderId,
      creditedBidderId,
      startsAt: row.startsAt,
      status: row.status,
      from,
      to,
    }),
  ).length;
}

export function canRecalculate(status: string) {
  return status === PaymentStatus.DRAFT;
}

export function canMarkReviewed(status: string) {
  return status === PaymentStatus.DRAFT;
}

export function canMarkPaid(status: string) {
  return status === PaymentStatus.REVIEWED;
}

export function rateCoversPeriod(
  rate: { effectiveFrom: Date; effectiveTo: Date | null },
  periodStart: Date,
) {
  if (rate.effectiveFrom.getTime() > periodStart.getTime()) {
    return false;
  }
  if (!rate.effectiveTo) {
    return true;
  }
  return rate.effectiveTo.getTime() > periodStart.getTime();
}

export type DatedCompensationRate = {
  applicationRate: string;
  interviewRate: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export function coveringRate<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(
  rows: T[],
  at: Date,
): T | null {
  return (
    [...rows]
      .filter((row) => rateCoversPeriod(row, at))
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0] ??
    null
  );
}

export function resolveBidderRates(params: {
  bidderId: number;
  periodStart: Date;
  individualRates: Array<DatedCompensationRate & { bidderId: number }>;
  globalRates: DatedCompensationRate[];
}): {
  applicationRate: string;
  interviewRate: string;
  source: 'individual' | 'default';
} | null {
  const individual = coveringRate(
    params.individualRates.filter((row) => row.bidderId === params.bidderId),
    params.periodStart,
  );
  if (individual) {
    return {
      applicationRate: String(individual.applicationRate),
      interviewRate: String(individual.interviewRate),
      source: 'individual',
    };
  }
  const global = coveringRate(params.globalRates, params.periodStart);
  if (!global) {
    return null;
  }
  return {
    applicationRate: String(global.applicationRate),
    interviewRate: String(global.interviewRate),
    source: 'default',
  };
}

export function canModifyIndividualBidderRates(actor: { role: string }) {
  return actor.role === 'ADMIN';
}

export function canViewIndividualBidderRateConfig(actor: {
  role: string;
  id: number;
}, bidderId: number) {
  if (actor.role === 'ADMIN') {
    return true;
  }
  if (actor.role === 'BIDDER' && actor.id !== bidderId) {
    return false;
  }
  return false;
}
