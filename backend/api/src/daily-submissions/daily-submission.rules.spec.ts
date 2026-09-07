import { ActivityType } from '../activity/activity-totals';
import { InterviewStatus } from '../interviews/interview.rules';
import { UserRole } from '../users/user-role.enum';
import {
  DAILY_SUBMISSION_MESSAGES,
  DailySubmissionStatus,
  accessBlockReason,
  applyLiveSystemIfDraft,
  calendarDayRange,
  canEditSubmission,
  canReopenSubmission,
  canReviewSubmission,
  canSubmitSubmission,
  adminCanSeeDailySubmission,
  countSystemApplications,
  countSystemInterviews,
  dailySubmissionRowUserIds,
  difference,
  freezeSystemSnapshot,
  isDailyReportUnread,
  parseReportingDate,
  shouldNotifyAdminOfDailyChange,
  shouldRefreshLiveSystemCounts,
  submissionBlockReason,
  uniqueManagerDateKey,
} from './daily-submission.rules';

describe('daily-submission.rules', () => {
  const from = new Date(2026, 7, 30, 0, 0, 0, 0);
  const to = new Date(2026, 7, 31, 0, 0, 0, 0);

  it('parses date-only reporting dates without UTC shift', () => {
    expect(parseReportingDate('2026-08-30')).toBe('2026-08-30');
    const range = calendarDayRange('2026-08-30');
    expect(range.from.getDate()).toBe(30);
    expect(range.from.getMonth()).toBe(7);
    expect(range.to.getDate()).toBe(31);
    expect(() => parseReportingDate('2026-13-01')).toThrow(
      DAILY_SUBMISSION_MESSAGES.invalidDate,
    );
  });

  it('enforces one manager per reporting date key', () => {
    expect(uniqueManagerDateKey(4, '2026-08-30')).toBe('4:2026-08-30');
    expect(uniqueManagerDateKey(4, '2026-08-30')).toBe(
      uniqueManagerDateKey(4, '2026-08-30'),
    );
    expect(uniqueManagerDateKey(5, '2026-08-30')).not.toBe(
      uniqueManagerDateKey(4, '2026-08-30'),
    );
  });

  it('adds the Bid Manager to the daily report and never an Admin', () => {
    expect(
      dailySubmissionRowUserIds({
        activeBidderIds: [10, 11],
        managerId: 4,
        managerRole: UserRole.BID_MANAGER,
      }),
    ).toEqual([10, 11, 4]);
    expect(
      dailySubmissionRowUserIds({
        activeBidderIds: [10],
        managerId: 1,
        managerRole: UserRole.ADMIN,
      }),
    ).toEqual([10]);
  });

  it('counts system applications from historical ActivityEvent bidder attribution for the day', () => {
    const events = [
      {
        bidderId: 10,
        type: ActivityType.APPLICATION,
        delta: 2,
        occurredAt: new Date(2026, 7, 30, 9, 0),
      },
      {
        bidderId: 10,
        type: ActivityType.APPLICATION,
        delta: 3,
        occurredAt: new Date(2026, 7, 30, 18, 0),
      },
      {
        bidderId: 11,
        type: ActivityType.APPLICATION,
        delta: 9,
        occurredAt: new Date(2026, 7, 30, 12, 0),
      },
      {
        bidderId: 10,
        type: ActivityType.APPLICATION,
        delta: 50,
        occurredAt: new Date(2026, 7, 31, 0, 0),
      },
      {
        bidderId: 10,
        type: ActivityType.RESUME,
        delta: 4,
        occurredAt: new Date(2026, 7, 30, 10, 0),
      },
    ];
    expect(countSystemApplications(events, 10, from, to)).toBe(5);
  });

  it('counts system interviews from Interview bidder attribution and payable statuses', () => {
    const interviews = [
      {
        bidderId: 10,
        startsAt: new Date(2026, 7, 30, 14, 0),
        status: InterviewStatus.SCHEDULED,
      },
      {
        bidderId: 10,
        startsAt: new Date(2026, 7, 30, 16, 0),
        status: InterviewStatus.COMPLETED,
      },
      {
        bidderId: 10,
        startsAt: new Date(2026, 7, 30, 11, 0),
        status: InterviewStatus.CANCELLED,
      },
      {
        bidderId: 10,
        startsAt: new Date(2026, 7, 29, 14, 0),
        status: InterviewStatus.SCHEDULED,
      },
      {
        bidderId: 11,
        startsAt: new Date(2026, 7, 30, 14, 0),
        status: InterviewStatus.SCHEDULED,
      },
    ];
    expect(countSystemInterviews(interviews, 10, from, to)).toBe(2);
  });

  it('treats zero as valid and blank as incomplete', () => {
    expect(difference(0, 5)).toBe(-5);
    expect(difference(2, 0)).toBe(2);
    expect(difference(null, 5)).toBeNull();
    expect(
      submissionBlockReason([
        { gmailConfirmedApplicationCount: 0, verifiedInterviewCount: 0 },
      ]),
    ).toBeNull();
    expect(
      submissionBlockReason([
        { gmailConfirmedApplicationCount: null, verifiedInterviewCount: 0 },
      ]),
    ).toBe(DAILY_SUBMISSION_MESSAGES.incomplete);
  });

  it('snapshots live system counts on submit and ignores later live changes', () => {
    const draft = {
      systemApplicationCount: 10,
      systemInterviewCount: 1,
      gmailConfirmedApplicationCount: 8,
      verifiedInterviewCount: 2,
      applicationDifference: null as number | null,
      interviewDifference: null as number | null,
    };
    const frozen = freezeSystemSnapshot(draft, {
      systemApplicationCount: 12,
      systemInterviewCount: 3,
    });
    expect(frozen.systemApplicationCount).toBe(12);
    expect(frozen.systemInterviewCount).toBe(3);
    expect(frozen.applicationDifference).toBe(-4);
    expect(frozen.interviewDifference).toBe(-1);

    const afterLaterActivity = applyLiveSystemIfDraft(
      DailySubmissionStatus.SUBMITTED,
      frozen,
      { systemApplicationCount: 99, systemInterviewCount: 20 },
    );
    expect(afterLaterActivity.systemApplicationCount).toBe(12);
    expect(afterLaterActivity.systemInterviewCount).toBe(3);
  });

  it('refreshes live system counts only while DRAFT', () => {
    const stored = {
      systemApplicationCount: 1,
      systemInterviewCount: 1,
      gmailConfirmedApplicationCount: 4,
      verifiedInterviewCount: 0,
      interviewDifference: null as number | null,
    };
    const refreshed = applyLiveSystemIfDraft(DailySubmissionStatus.DRAFT, stored, {
      systemApplicationCount: 7,
      systemInterviewCount: 2,
    });
    expect(refreshed.systemApplicationCount).toBe(7);
    expect(refreshed.interviewDifference).toBe(-2);
  });

  it('blocks BIDDER access and another manager from a private draft', () => {
    expect(
      accessBlockReason({
        actorRole: UserRole.BIDDER,
        actorId: 9,
        managerId: 4,
      }),
    ).toBe(DAILY_SUBMISSION_MESSAGES.bidderForbidden);
    expect(
      accessBlockReason({
        actorRole: UserRole.BID_MANAGER,
        actorId: 5,
        managerId: 4,
      }),
    ).toBe(DAILY_SUBMISSION_MESSAGES.notOwner);
    expect(
      accessBlockReason({
        actorRole: UserRole.BID_MANAGER,
        actorId: 4,
        managerId: 4,
      }),
    ).toBeNull();
    expect(
      accessBlockReason({
        actorRole: UserRole.ADMIN,
        actorId: 1,
        managerId: 4,
      }),
    ).toBeNull();
  });

  it('lets Bid Managers edit until ADMIN approves, then only ADMIN can edit', () => {
    expect(canEditSubmission(DailySubmissionStatus.DRAFT)).toBe(true);
    expect(canEditSubmission(DailySubmissionStatus.SUBMITTED)).toBe(true);
    expect(
      canEditSubmission(DailySubmissionStatus.REVIEWED, UserRole.BID_MANAGER),
    ).toBe(false);
    expect(
      canEditSubmission(DailySubmissionStatus.REVIEWED, UserRole.ADMIN),
    ).toBe(true);
    expect(canSubmitSubmission(DailySubmissionStatus.DRAFT)).toBe(true);
    expect(canSubmitSubmission(DailySubmissionStatus.SUBMITTED)).toBe(true);
    expect(canSubmitSubmission(DailySubmissionStatus.REVIEWED)).toBe(false);
    expect(shouldRefreshLiveSystemCounts(DailySubmissionStatus.DRAFT)).toBe(
      true,
    );
    expect(
      shouldRefreshLiveSystemCounts(DailySubmissionStatus.SUBMITTED),
    ).toBe(false);
    expect(canReopenSubmission(DailySubmissionStatus.SUBMITTED)).toBe(true);
    expect(canReviewSubmission(DailySubmissionStatus.SUBMITTED)).toBe(true);
    expect(canReviewSubmission(DailySubmissionStatus.DRAFT)).toBe(false);
    expect(adminCanSeeDailySubmission(DailySubmissionStatus.DRAFT)).toBe(false);
    expect(adminCanSeeDailySubmission(DailySubmissionStatus.SUBMITTED)).toBe(
      true,
    );
    expect(adminCanSeeDailySubmission(DailySubmissionStatus.REVIEWED)).toBe(
      true,
    );
  });

  it('treats a manager submit or later change as unread until admin opens it', () => {
    expect(
      shouldNotifyAdminOfDailyChange(DailySubmissionStatus.DRAFT),
    ).toBe(false);
    expect(
      shouldNotifyAdminOfDailyChange(DailySubmissionStatus.SUBMITTED),
    ).toBe(true);
    expect(
      isDailyReportUnread({
        status: DailySubmissionStatus.SUBMITTED,
        contentChangedAt: null,
        readAt: null,
      }),
    ).toBe(false);
    expect(
      isDailyReportUnread({
        status: DailySubmissionStatus.REVIEWED,
        contentChangedAt: new Date('2026-08-31T17:00:00.000Z'),
        readAt: null,
      }),
    ).toBe(false);
    const changed = new Date('2026-08-31T17:00:00.000Z');
    expect(
      isDailyReportUnread({
        status: DailySubmissionStatus.SUBMITTED,
        contentChangedAt: changed,
        readAt: null,
      }),
    ).toBe(true);
    expect(
      isDailyReportUnread({
        status: DailySubmissionStatus.SUBMITTED,
        contentChangedAt: changed,
        readAt: new Date('2026-08-31T17:05:00.000Z'),
      }),
    ).toBe(false);
    expect(
      isDailyReportUnread({
        status: DailySubmissionStatus.SUBMITTED,
        contentChangedAt: new Date('2026-08-31T18:00:00.000Z'),
        readAt: new Date('2026-08-31T17:05:00.000Z'),
      }),
    ).toBe(true);
  });
});
