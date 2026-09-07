import { isPayableInterviewStatus } from '../compensation/compensation.rules';
import { ActivityType } from '../activity/activity-totals';
import { UserRole } from '../users/user-role.enum';

export const DailySubmissionStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
} as const;

export const DAILY_SUBMISSION_STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.BID_MANAGER,
] as const;

export const DAILY_SUBMISSION_MESSAGES = {
  bidderForbidden: 'Bidders cannot access daily submissions.',
  notOwner: 'You can only access your own daily submissions.',
  locked: 'This daily report is locked. Ask a manager to return it to draft if a correction is needed.',
  incomplete:
    'Complete the verified counts for all bidders before submitting.',
  notDraft: 'This daily report cannot be submitted.',
  notReopenable: 'Only a pending or approved report can be reopened.',
  notReviewable: 'Only a pending daily report can be approved.',
  notSubmitted: 'This daily report has not been submitted yet.',
  invalidDate: 'Reporting date must be YYYY-MM-DD.',
} as const;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseReportingDate(value: string): string {
  const match = DATE_ONLY.exec(value.trim());
  if (!match) {
    throw new Error(DAILY_SUBMISSION_MESSAGES.invalidDate);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    throw new Error(DAILY_SUBMISSION_MESSAGES.invalidDate);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function todayReportingDate(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Local calendar day: from 00:00 inclusive through next midnight exclusive. */
export function calendarDayRange(isoDate: string) {
  const date = parseReportingDate(isoDate);
  const [year, month, day] = date.split('-').map(Number);
  const from = new Date(year, month - 1, day, 0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to, reportingDate: date };
}

export function uniqueManagerDateKey(managerId: number, reportingDate: string) {
  return `${managerId}:${parseReportingDate(reportingDate)}`;
}

export function dailySubmissionRowUserIds(params: {
  activeBidderIds: number[];
  managerId: number;
  managerRole: string;
}): number[] {
  const ids = params.activeBidderIds.filter((id) => id !== params.managerId);
  if (params.managerRole === UserRole.BID_MANAGER) {
    ids.push(params.managerId);
  }
  return ids;
}

export function countSystemApplications(
  events: Array<{
    bidderId: number | null;
    type: string;
    delta: number;
    occurredAt: Date | string;
  }>,
  bidderId: number,
  from: Date,
  to: Date,
) {
  let total = 0;
  for (const event of events) {
    if (event.bidderId !== bidderId) {
      continue;
    }
    if (event.type !== ActivityType.APPLICATION) {
      continue;
    }
    const time = new Date(event.occurredAt).getTime();
    if (time >= from.getTime() && time < to.getTime()) {
      total += event.delta;
    }
  }
  return total;
}

export function countSystemInterviews(
  interviews: Array<{
    bidderId: number | null;
    startsAt: Date | string;
    status: string | null;
  }>,
  bidderId: number,
  from: Date,
  to: Date,
) {
  return interviews.filter((row) => {
    if (row.bidderId !== bidderId) {
      return false;
    }
    if (!isPayableInterviewStatus(row.status)) {
      return false;
    }
    const start = new Date(row.startsAt).getTime();
    return start >= from.getTime() && start < to.getTime();
  }).length;
}

export function difference(verified: number | null, system: number): number | null {
  if (verified == null) {
    return null;
  }
  return verified - system;
}

export function isBlankCount(value: number | null | undefined): boolean {
  return value == null;
}

export function submissionBlockReason(
  rows: Array<{
    gmailConfirmedApplicationCount: number | null;
    verifiedInterviewCount: number | null;
  }>,
): string | null {
  const incomplete = rows.some(
    (row) =>
      isBlankCount(row.gmailConfirmedApplicationCount) ||
      isBlankCount(row.verifiedInterviewCount),
  );
  return incomplete ? DAILY_SUBMISSION_MESSAGES.incomplete : null;
}

export function canEditSubmission(status: string, actorRole?: string) {
  if (actorRole === UserRole.ADMIN) {
    return (
      status === DailySubmissionStatus.SUBMITTED ||
      status === DailySubmissionStatus.REVIEWED
    );
  }
  return (
    status === DailySubmissionStatus.DRAFT ||
    status === DailySubmissionStatus.SUBMITTED
  );
}

export function canSubmitSubmission(status: string) {
  return (
    status === DailySubmissionStatus.DRAFT ||
    status === DailySubmissionStatus.SUBMITTED
  );
}

export function shouldRefreshLiveSystemCounts(status: string) {
  return status === DailySubmissionStatus.DRAFT;
}

export function canReopenSubmission(status: string) {
  return (
    status === DailySubmissionStatus.SUBMITTED ||
    status === DailySubmissionStatus.REVIEWED
  );
}

export function canReviewSubmission(status: string) {
  return status === DailySubmissionStatus.SUBMITTED;
}

/** ADMIN only sees reports after the Bid Manager submits them. */
export function adminCanSeeDailySubmission(status: string) {
  return status !== DailySubmissionStatus.DRAFT;
}

export function applyLiveSystemIfDraft<
  T extends {
    systemApplicationCount: number;
    systemInterviewCount: number;
    gmailConfirmedApplicationCount: number | null;
    verifiedInterviewCount: number | null;
    applicationDifference?: number | null;
    interviewDifference?: number | null;
  },
>(
  status: string,
  stored: T,
  live: { systemApplicationCount: number; systemInterviewCount: number },
): T {
  if (status !== DailySubmissionStatus.DRAFT) {
    return stored;
  }
  return {
    ...stored,
    systemApplicationCount: live.systemApplicationCount,
    systemInterviewCount: live.systemInterviewCount,
    applicationDifference: difference(
      stored.gmailConfirmedApplicationCount,
      live.systemApplicationCount,
    ),
    interviewDifference: difference(
      stored.verifiedInterviewCount,
      live.systemInterviewCount,
    ),
  };
}

export function freezeSystemSnapshot<
  T extends {
    gmailConfirmedApplicationCount: number | null;
    verifiedInterviewCount: number | null;
  },
>(
  row: T,
  live: { systemApplicationCount: number; systemInterviewCount: number },
) {
  return {
    ...row,
    systemApplicationCount: live.systemApplicationCount,
    systemInterviewCount: live.systemInterviewCount,
    applicationDifference: difference(
      row.gmailConfirmedApplicationCount,
      live.systemApplicationCount,
    ),
    interviewDifference: difference(
      row.verifiedInterviewCount,
      live.systemInterviewCount,
    ),
  };
}

export function isDailyReportUnread(params: {
  status: string;
  contentChangedAt: Date | string | null | undefined;
  readAt: Date | string | null | undefined;
}) {
  if (params.status !== DailySubmissionStatus.SUBMITTED) {
    return false;
  }
  if (!params.contentChangedAt) {
    return false;
  }
  if (!params.readAt) {
    return true;
  }
  return (
    new Date(params.contentChangedAt).getTime() >
    new Date(params.readAt).getTime()
  );
}

export function shouldNotifyAdminOfDailyChange(status: string) {
  return status === DailySubmissionStatus.SUBMITTED;
}

export function accessBlockReason(params: {
  actorRole: string;
  actorId: number;
  managerId: number;
}): string | null {
  if (params.actorRole === UserRole.BIDDER) {
    return DAILY_SUBMISSION_MESSAGES.bidderForbidden;
  }
  if (
    params.actorRole === UserRole.BID_MANAGER &&
    params.actorId !== params.managerId
  ) {
    return DAILY_SUBMISSION_MESSAGES.notOwner;
  }
  return null;
}

export function rollupVerifiedTotals(
  rows: Array<{
    systemApplicationCount: number;
    gmailConfirmedApplicationCount: number | null;
    systemInterviewCount: number;
    verifiedInterviewCount: number | null;
  }>,
) {
  return rows.reduce(
    (acc, row) => ({
      systemApplications: acc.systemApplications + row.systemApplicationCount,
      gmailConfirmed:
        acc.gmailConfirmed + (row.gmailConfirmedApplicationCount ?? 0),
      gmailFilled:
        acc.gmailFilled + (row.gmailConfirmedApplicationCount == null ? 0 : 1),
      systemInterviews: acc.systemInterviews + row.systemInterviewCount,
      verifiedInterviews:
        acc.verifiedInterviews + (row.verifiedInterviewCount ?? 0),
      interviewsFilled:
        acc.interviewsFilled + (row.verifiedInterviewCount == null ? 0 : 1),
      assignedProfiles: acc.assignedProfiles,
    }),
    {
      systemApplications: 0,
      gmailConfirmed: 0,
      gmailFilled: 0,
      systemInterviews: 0,
      verifiedInterviews: 0,
      interviewsFilled: 0,
      assignedProfiles: 0,
    },
  );
}
