import { bidderPay, parseScaled, sumUsd } from '../compensation/compensation-money';
import { resolveBidderRates } from '../compensation/compensation.rules';
import {
  DailySubmissionStatus,
  parseReportingDate,
} from '../daily-submissions/daily-submission.rules';
import { UserRole } from '../users/user-role.enum';

export const WeeklyInvoiceStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
} as const;

export const DailyCoverageStatus = {
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
  DRAFT: 'DRAFT',
  MISSING: 'MISSING',
  NO_ACTIVITY: 'NO_ACTIVITY',
  WEEKEND_OFF: 'WEEKEND_OFF',
} as const;

export const WEEKLY_INVOICE_STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.BID_MANAGER,
] as const;

export const WEEK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export const WEEKLY_INVOICE_MESSAGES = {
  bidderForbidden: 'Bidders cannot access weekly invoices.',
  notOwner: 'You can only access your own weekly invoices.',
  locked: 'This weekly invoice is locked. Ask a manager to return it to draft if a correction is needed.',
  notDraft: 'Only a draft weekly invoice can be submitted.',
  notReviewable: 'Only a pending weekly invoice can be marked reviewed.',
  notApprovable: 'Only a pending weekly invoice can be approved.',
  notReopenable: 'This weekly invoice cannot be reopened.',
  notSubmitted:
    'This weekly invoice has not been submitted yet.',
  countReason:
    'Provide an adjustment reason when invoice counts differ from Daily Submission totals.',
  rateReason:
    'Provide a rate adjustment reason when invoice rates differ from configured compensation rates.',
  missingDays:
    'Acknowledge missing daily submissions: mark No activity or explain why the invoice is submitted without those days.',
  invalidWeek: 'Weekly invoice period must be Monday through Sunday.',
  invalidRate: 'Invoice rates must be valid non-negative decimals.',
} as const;

export function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = parseReportingDate(isoDate).split('-').map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return toIsoDate(next);
}

export function mondayOfWeek(isoDate: string): string {
  const [year, month, day] = parseReportingDate(isoDate).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + offset);
  return toIsoDate(date);
}

export function sundayOfWeek(periodStart: string): string {
  return addDays(mondayOfWeek(periodStart), 6);
}

export function weekDayIsos(periodStart: string): string[] {
  const monday = mondayOfWeek(periodStart);
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(monday, offset));
}

export function assertMondaySundayPeriod(periodStart: string, periodEnd: string) {
  const monday = mondayOfWeek(periodStart);
  if (monday !== parseReportingDate(periodStart)) {
    throw new Error(WEEKLY_INVOICE_MESSAGES.invalidWeek);
  }
  if (sundayOfWeek(monday) !== parseReportingDate(periodEnd)) {
    throw new Error(WEEKLY_INVOICE_MESSAGES.invalidWeek);
  }
  return { periodStart: monday, periodEnd: sundayOfWeek(monday) };
}

export function weekdayNumber(isoDate: string): number {
  const [year, month, day] = parseReportingDate(isoDate).split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function isWeekend(isoDate: string) {
  const day = weekdayNumber(isoDate);
  return day === 0 || day === 6;
}

export function isStandardWorkday(isoDate: string) {
  return !isWeekend(isoDate);
}

export function uniqueManagerWeekKey(
  managerId: number,
  periodStart: string,
  periodEnd: string,
) {
  const period = assertMondaySundayPeriod(periodStart, periodEnd);
  return `${managerId}:${period.periodStart}:${period.periodEnd}`;
}

export function isVerifiedDailyStatus(status: string | null | undefined) {
  return (
    status === DailySubmissionStatus.SUBMITTED ||
    status === DailySubmissionStatus.REVIEWED
  );
}

export function coverageForDay(params: {
  reportingDate: string;
  submissionStatus: string | null;
  markedNoActivity: boolean;
}): string {
  if (isVerifiedDailyStatus(params.submissionStatus)) {
    return params.submissionStatus === DailySubmissionStatus.REVIEWED
      ? DailyCoverageStatus.REVIEWED
      : DailyCoverageStatus.SUBMITTED;
  }
  if (params.markedNoActivity) {
    return DailyCoverageStatus.NO_ACTIVITY;
  }
  if (params.submissionStatus === DailySubmissionStatus.DRAFT) {
    return DailyCoverageStatus.DRAFT;
  }
  if (isWeekend(params.reportingDate)) {
    return DailyCoverageStatus.WEEKEND_OFF;
  }
  return DailyCoverageStatus.MISSING;
}

export function dayCountsTowardDefaults(coverage: string) {
  return (
    coverage === DailyCoverageStatus.SUBMITTED ||
    coverage === DailyCoverageStatus.REVIEWED
  );
}

export function verifiedCountOrZero(
  coverage: string,
  value: number | null | undefined,
) {
  if (!dayCountsTowardDefaults(coverage)) {
    return 0;
  }
  return value ?? 0;
}

export function sumWeeklyDefaults(
  days: Array<{
    coverage: string;
    gmailConfirmedApplicationCount: number | null;
    verifiedInterviewCount: number | null;
  }>,
) {
  return days.reduce(
    (acc, day) => ({
      applications:
        acc.applications +
        verifiedCountOrZero(day.coverage, day.gmailConfirmedApplicationCount),
      interviews:
        acc.interviews +
        verifiedCountOrZero(day.coverage, day.verifiedInterviewCount),
    }),
    { applications: 0, interviews: 0 },
  );
}

export function missingCoverageDays(
  days: Array<{ reportingDate: string; coverage: string }>,
) {
  return days
    .filter(
      (day) =>
        isStandardWorkday(day.reportingDate) &&
        (day.coverage === DailyCoverageStatus.MISSING ||
          day.coverage === DailyCoverageStatus.DRAFT),
    )
    .map((day) => day.reportingDate);
}

export function missingDaySubmitBlock(params: {
  missingDates: string[];
  acknowledgement: string | null | undefined;
}): string | null {
  if (params.missingDates.length === 0) {
    return null;
  }
  if (params.acknowledgement?.trim()) {
    return null;
  }
  return WEEKLY_INVOICE_MESSAGES.missingDays;
}

export function ratesEqual(left: string, right: string) {
  try {
    return parseScaled(left) === parseScaled(right);
  } catch {
    return false;
  }
}

export function parseInvoiceRate(value: string) {
  let scaled: bigint;
  try {
    scaled = parseScaled(value);
  } catch {
    throw new Error(WEEKLY_INVOICE_MESSAGES.invalidRate);
  }
  if (scaled < 0n) {
    throw new Error(WEEKLY_INVOICE_MESSAGES.invalidRate);
  }
  return String(value).trim();
}

export function countDifference(invoiceCount: number, defaultCount: number) {
  return invoiceCount - defaultCount;
}

export function rowCountReasonBlock(params: {
  invoiceApplicationCount: number;
  invoiceInterviewCount: number;
  defaultApplicationCount: number;
  defaultInterviewCount: number;
  countAdjustmentReason: string | null | undefined;
}): string | null {
  const changed =
    params.invoiceApplicationCount !== params.defaultApplicationCount ||
    params.invoiceInterviewCount !== params.defaultInterviewCount;
  if (!changed) {
    return null;
  }
  return params.countAdjustmentReason?.trim()
    ? null
    : WEEKLY_INVOICE_MESSAGES.countReason;
}

export function rowRateReasonBlock(params: {
  invoiceApplicationRate: string;
  invoiceInterviewRate: string;
  configuredApplicationRate: string;
  configuredInterviewRate: string;
  rateAdjustmentReason: string | null | undefined;
}): string | null {
  const changed =
    !ratesEqual(params.invoiceApplicationRate, params.configuredApplicationRate) ||
    !ratesEqual(params.invoiceInterviewRate, params.configuredInterviewRate);
  if (!changed) {
    return null;
  }
  return params.rateAdjustmentReason?.trim()
    ? null
    : WEEKLY_INVOICE_MESSAGES.rateReason;
}

export function refreshDefaultsWithoutOverwritingInvoice<
  T extends {
    defaultApplicationCount: number;
    defaultInterviewCount: number;
    invoiceApplicationCount: number;
    invoiceInterviewCount: number;
  },
>(stored: T, live: { applications: number; interviews: number }): T {
  return {
    ...stored,
    defaultApplicationCount: live.applications,
    defaultInterviewCount: live.interviews,
  };
}

export function resetInvoiceCountsToDefaults<
  T extends {
    defaultApplicationCount: number;
    defaultInterviewCount: number;
    invoiceApplicationCount: number;
    invoiceInterviewCount: number;
    countAdjustmentReason?: string | null;
  },
>(stored: T): T {
  return {
    ...stored,
    invoiceApplicationCount: stored.defaultApplicationCount,
    invoiceInterviewCount: stored.defaultInterviewCount,
    countAdjustmentReason: null,
  };
}

export function applyLiveDefaultsIfDraft<
  T extends {
    defaultApplicationCount: number;
    defaultInterviewCount: number;
    invoiceApplicationCount: number;
    invoiceInterviewCount: number;
  },
>(status: string, stored: T, live: { applications: number; interviews: number }): T {
  if (status !== WeeklyInvoiceStatus.DRAFT) {
    return stored;
  }
  return refreshDefaultsWithoutOverwritingInvoice(stored, live);
}

export function bidderInvoiceAmounts(params: {
  invoiceApplicationCount: number;
  invoiceInterviewCount: number;
  invoiceApplicationRate: string;
  invoiceInterviewRate: string;
}) {
  return bidderPay({
    applicationCount: params.invoiceApplicationCount,
    interviewCount: params.invoiceInterviewCount,
    applicationRate: params.invoiceApplicationRate,
    interviewRate: params.invoiceInterviewRate,
  });
}

export function teamInvoiceTotal(
  rows: Array<{ applicationAmount: string; interviewAmount: string }>,
) {
  return {
    applicationAmount: sumUsd(rows.map((row) => row.applicationAmount)),
    interviewAmount: sumUsd(rows.map((row) => row.interviewAmount)),
    totalAmount: sumUsd(
      rows.map((row) => sumUsd([row.applicationAmount, row.interviewAmount])),
    ),
  };
}

export function invoiceBidderIds(
  activeBidderIds: number[],
  dailyBidderIds: number[],
) {
  return [...new Set([...activeBidderIds, ...dailyBidderIds])].sort(
    (a, b) => a - b,
  );
}

export function canEditInvoice(status: string, actorRole?: string) {
  if (actorRole === UserRole.ADMIN) {
    return (
      status === WeeklyInvoiceStatus.SUBMITTED ||
      status === WeeklyInvoiceStatus.REVIEWED ||
      status === WeeklyInvoiceStatus.APPROVED
    );
  }
  return (
    status === WeeklyInvoiceStatus.DRAFT ||
    status === WeeklyInvoiceStatus.SUBMITTED ||
    status === WeeklyInvoiceStatus.REVIEWED
  );
}

export function canSubmitInvoice(status: string) {
  return (
    status === WeeklyInvoiceStatus.DRAFT ||
    status === WeeklyInvoiceStatus.SUBMITTED ||
    status === WeeklyInvoiceStatus.REVIEWED
  );
}

export function canReviewInvoice(status: string, actorRole: string) {
  return (
    actorRole === UserRole.ADMIN && status === WeeklyInvoiceStatus.SUBMITTED
  );
}

export function canApproveInvoice(status: string, actorRole: string) {
  return (
    actorRole === UserRole.ADMIN &&
    (status === WeeklyInvoiceStatus.SUBMITTED ||
      status === WeeklyInvoiceStatus.REVIEWED)
  );
}

export function canReopenInvoice(status: string, actorRole: string) {
  return (
    actorRole === UserRole.ADMIN &&
    (status === WeeklyInvoiceStatus.SUBMITTED ||
      status === WeeklyInvoiceStatus.REVIEWED ||
      status === WeeklyInvoiceStatus.APPROVED)
  );
}

/** ADMIN only sees invoices after the Bid Manager submits them. */
export function adminCanSeeInvoice(status: string) {
  return status !== WeeklyInvoiceStatus.DRAFT;
}

export function accessBlockReason(params: {
  actorRole: string;
  actorId: number;
  managerId: number;
}): string | null {
  if (params.actorRole === UserRole.BIDDER) {
    return WEEKLY_INVOICE_MESSAGES.bidderForbidden;
  }
  if (
    params.actorRole === UserRole.BID_MANAGER &&
    params.actorId !== params.managerId
  ) {
    return WEEKLY_INVOICE_MESSAGES.notOwner;
  }
  return null;
}

export { resolveBidderRates };
