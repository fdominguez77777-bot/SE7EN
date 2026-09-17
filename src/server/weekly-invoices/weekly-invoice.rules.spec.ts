import { DailySubmissionStatus } from '../daily-submissions/daily-submission.rules';
import { UserRole } from '../users/user-role.enum';
import {
  DailyCoverageStatus,
  WEEKLY_INVOICE_MESSAGES,
  WeeklyInvoiceStatus,
  accessBlockReason,
  applyLiveDefaultsIfDraft,
  assertMondaySundayPeriod,
  bidderInvoiceAmounts,
  canApproveInvoice,
  canEditInvoice,
  canReviewInvoice,
  canSubmitInvoice,
  adminCanSeeInvoice,
  coverageForDay,
  countDifference,
  dayCountsTowardDefaults,
  invoiceBidderIds,
  missingCoverageDays,
  missingDaySubmitBlock,
  mondayOfWeek,
  refreshDefaultsWithoutOverwritingInvoice,
  resetInvoiceCountsToDefaults,
  rowCountReasonBlock,
  rowRateReasonBlock,
  sumWeeklyDefaults,
  sundayOfWeek,
  teamInvoiceTotal,
  uniqueManagerWeekKey,
  weekDayIsos,
  isStandardWorkday,
  isWeekend,
} from './weekly-invoice.rules';
import { resolveBidderRates } from '../compensation/compensation.rules';

describe('weekly invoice week range', () => {
  it('uses Monday through Sunday', () => {
    expect(mondayOfWeek('2026-08-30')).toBe('2026-08-24');
    expect(sundayOfWeek('2026-08-24')).toBe('2026-08-30');
    expect(weekDayIsos('2026-08-26')).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
    expect(assertMondaySundayPeriod('2026-08-24', '2026-08-30')).toEqual({
      periodStart: '2026-08-24',
      periodEnd: '2026-08-30',
    });
    expect(uniqueManagerWeekKey(4, '2026-08-24', '2026-08-30')).toBe(
      '4:2026-08-24:2026-08-30',
    );
  });
});

const fabianDays = [
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 100,
    verifiedInterviewCount: 1,
  },
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 105,
    verifiedInterviewCount: 0,
  },
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 90,
    verifiedInterviewCount: 2,
  },
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 110,
    verifiedInterviewCount: 1,
  },
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 95,
    verifiedInterviewCount: 1,
  },
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 0,
    verifiedInterviewCount: 0,
  },
  {
    coverage: DailyCoverageStatus.SUBMITTED,
    gmailConfirmedApplicationCount: 0,
    verifiedInterviewCount: 0,
  },
];

describe('weekly invoice defaults from daily submissions', () => {
  it('sums Monday-Sunday Gmail confirmed applications', () => {
    expect(sumWeeklyDefaults(fabianDays).applications).toBe(500);
  });

  it('sums Monday-Sunday verified interviews', () => {
    expect(sumWeeklyDefaults(fabianDays).interviews).toBe(5);
  });

  it('distinguishes missing daily submissions from submitted zero', () => {
    const submittedZero = coverageForDay({
      reportingDate: '2026-08-28',
      submissionStatus: DailySubmissionStatus.SUBMITTED,
      markedNoActivity: false,
    });
    const missingWeekday = coverageForDay({
      reportingDate: '2026-08-28',
      submissionStatus: null,
      markedNoActivity: false,
    });
    expect(submittedZero).toBe(DailyCoverageStatus.SUBMITTED);
    expect(missingWeekday).toBe(DailyCoverageStatus.MISSING);
    expect(dayCountsTowardDefaults(submittedZero)).toBe(true);
    expect(dayCountsTowardDefaults(missingWeekday)).toBe(false);
    expect(
      sumWeeklyDefaults([
        {
          coverage: submittedZero,
          gmailConfirmedApplicationCount: 0,
          verifiedInterviewCount: 0,
        },
      ]),
    ).toEqual({ applications: 0, interviews: 0 });
    expect(
      sumWeeklyDefaults([
        {
          coverage: missingWeekday,
          gmailConfirmedApplicationCount: null,
          verifiedInterviewCount: null,
        },
      ]),
    ).toEqual({ applications: 0, interviews: 0 });
    expect(
      missingCoverageDays([
        { reportingDate: '2026-08-28', coverage: submittedZero },
        { reportingDate: '2026-08-27', coverage: missingWeekday },
      ]),
    ).toEqual(['2026-08-27']);
  });

  it('does not invent verified numbers for missing days', () => {
    const days = [
      ...fabianDays.slice(0, 5),
      {
        coverage: DailyCoverageStatus.MISSING,
        gmailConfirmedApplicationCount: null,
        verifiedInterviewCount: null,
      },
      {
        coverage: DailyCoverageStatus.MISSING,
        gmailConfirmedApplicationCount: null,
        verifiedInterviewCount: null,
      },
    ];
    expect(sumWeeklyDefaults(days)).toEqual({
      applications: 500,
      interviews: 5,
    });
  });
});

describe('weekly invoice edits and reasons', () => {
  it('lets the manager change invoice counts away from daily defaults', () => {
    const daily = { applications: 500, interviews: 5 };
    const invoice = { applications: 510, interviews: 4 };
    expect(countDifference(invoice.applications, daily.applications)).toBe(10);
    expect(countDifference(invoice.interviews, daily.interviews)).toBe(-1);
  });

  it('does not rewrite Daily Submission history when invoice counts change', () => {
    const dailyRow = {
      gmailConfirmedApplicationCount: 100,
      verifiedInterviewCount: 1,
    };
    const frozen = { ...dailyRow };
    const invoiceApplicationCount = 110;
    expect(invoiceApplicationCount).not.toBe(frozen.gmailConfirmedApplicationCount);
    expect(dailyRow).toEqual(frozen);
  });

  it('lets the manager change invoice rates without changing compensation config', () => {
    const configured = { applicationRate: '0.03', interviewRate: '1.00' };
    const invoice = { applicationRate: '0.04', interviewRate: '1.00' };
    expect(invoice.applicationRate).not.toBe(configured.applicationRate);
    expect(configured).toEqual({
      applicationRate: '0.03',
      interviewRate: '1.00',
    });
  });

  it('requires a reason when counts change and when rates change', () => {
    expect(
      rowCountReasonBlock({
        invoiceApplicationCount: 510,
        invoiceInterviewCount: 5,
        defaultApplicationCount: 500,
        defaultInterviewCount: 5,
        countAdjustmentReason: null,
      }),
    ).toBe(WEEKLY_INVOICE_MESSAGES.countReason);
    expect(
      rowCountReasonBlock({
        invoiceApplicationCount: 510,
        invoiceInterviewCount: 5,
        defaultApplicationCount: 500,
        defaultInterviewCount: 5,
        countAdjustmentReason: 'Two Gmail confirmations arrived late.',
      }),
    ).toBeNull();
    expect(
      rowCountReasonBlock({
        invoiceApplicationCount: 500,
        invoiceInterviewCount: 5,
        defaultApplicationCount: 500,
        defaultInterviewCount: 5,
        countAdjustmentReason: null,
      }),
    ).toBeNull();
    expect(
      rowRateReasonBlock({
        invoiceApplicationRate: '0.04',
        invoiceInterviewRate: '1.00',
        configuredApplicationRate: '0.03',
        configuredInterviewRate: '1.00',
        rateAdjustmentReason: null,
      }),
    ).toBe(WEEKLY_INVOICE_MESSAGES.rateReason);
    expect(
      rowRateReasonBlock({
        invoiceApplicationRate: '0.04',
        invoiceInterviewRate: '1.00',
        configuredApplicationRate: '0.03',
        configuredInterviewRate: '1.00',
        rateAdjustmentReason: 'Special weekly rate agreed with ADMIN.',
      }),
    ).toBeNull();
  });

  it('requires acknowledgement when required workdays are missing', () => {
    expect(
      missingDaySubmitBlock({
        missingDates: ['2026-08-27'],
        acknowledgement: null,
      }),
    ).toBe(WEEKLY_INVOICE_MESSAGES.missingDays);
    expect(
      missingDaySubmitBlock({
        missingDates: ['2026-08-27'],
        acknowledgement: 'Thursday bidding was paused for training.',
      }),
    ).toBeNull();
    expect(
      missingDaySubmitBlock({ missingDates: [], acknowledgement: null }),
    ).toBeNull();
  });
});

describe('weekly invoice money', () => {
  it('500 apps at $0.03 and 5 interviews at $1.00 equals $20.00', () => {
    expect(
      bidderInvoiceAmounts({
        invoiceApplicationCount: 500,
        invoiceInterviewCount: 5,
        invoiceApplicationRate: '0.03',
        invoiceInterviewRate: '1.00',
      }),
    ).toEqual({
      applicationPayAmount: '15.00',
      interviewPayAmount: '5.00',
      totalAmount: '20.00',
      hasBasePay: false,
    });
  });

  it('prefills the individual bidder rate when effective', () => {
    const periodStart = new Date(2026, 7, 24);
    expect(
      resolveBidderRates({
        bidderId: 9,
        periodStart,
        individualRates: [
          {
            bidderId: 9,
            applicationRate: '0.04',
            interviewRate: '1.50',
            effectiveFrom: new Date(2026, 0, 1),
            effectiveTo: null,
          },
        ],
        globalRates: [
          {
            applicationRate: '0.03',
            interviewRate: '1.00',
            effectiveFrom: new Date(2026, 0, 1),
            effectiveTo: null,
          },
        ],
      }),
    ).toEqual({
      applicationRate: '0.04',
      interviewRate: '1.50',
      source: 'individual',
    });
  });

  it('sums mixed bidder rates instead of one global rate', () => {
    const fabian = bidderInvoiceAmounts({
      invoiceApplicationCount: 500,
      invoiceInterviewCount: 5,
      invoiceApplicationRate: '0.04',
      invoiceInterviewRate: '1.50',
    });
    const joe = bidderInvoiceAmounts({
      invoiceApplicationCount: 100,
      invoiceInterviewCount: 2,
      invoiceApplicationRate: '0.03',
      invoiceInterviewRate: '1.00',
    });
    expect(fabian.totalAmount).toBe('27.50');
    expect(joe.totalAmount).toBe('5.00');
    expect(
      teamInvoiceTotal([
        {
          applicationAmount: fabian.applicationPayAmount,
          interviewAmount: fabian.interviewPayAmount,
        },
        {
          applicationAmount: joe.applicationPayAmount,
          interviewAmount: joe.interviewPayAmount,
        },
      ]).totalAmount,
    ).toBe('32.50');
  });
});

describe('weekly invoice draft refresh and submit lock', () => {
  it('refreshes default counts without overwriting manager invoice values', () => {
    const stored = {
      defaultApplicationCount: 500,
      defaultInterviewCount: 5,
      invoiceApplicationCount: 510,
      invoiceInterviewCount: 4,
    };
    const refreshed = refreshDefaultsWithoutOverwritingInvoice(stored, {
      applications: 600,
      interviews: 6,
    });
    expect(refreshed.defaultApplicationCount).toBe(600);
    expect(refreshed.invoiceApplicationCount).toBe(510);
    expect(refreshed.invoiceInterviewCount).toBe(4);
    expect(
      resetInvoiceCountsToDefaults(refreshed).invoiceApplicationCount,
    ).toBe(600);
  });

  it('does not rewrite a submitted snapshot when later daily totals change', () => {
    const submitted = applyLiveDefaultsIfDraft(
      WeeklyInvoiceStatus.SUBMITTED,
      {
        defaultApplicationCount: 500,
        defaultInterviewCount: 5,
        invoiceApplicationCount: 500,
        invoiceInterviewCount: 5,
      },
      { applications: 999, interviews: 40 },
    );
    expect(submitted.defaultApplicationCount).toBe(500);
    expect(submitted.invoiceApplicationCount).toBe(500);
    const draft = applyLiveDefaultsIfDraft(
      WeeklyInvoiceStatus.DRAFT,
      storedRow(),
      { applications: 600, interviews: 6 },
    );
    expect(draft.defaultApplicationCount).toBe(600);
    expect(draft.invoiceApplicationCount).toBe(510);
  });

  it('lets Bid Managers edit until ADMIN approves, then only ADMIN can edit', () => {
    expect(canEditInvoice(WeeklyInvoiceStatus.DRAFT)).toBe(true);
    expect(canSubmitInvoice(WeeklyInvoiceStatus.DRAFT)).toBe(true);
    expect(canEditInvoice(WeeklyInvoiceStatus.SUBMITTED)).toBe(true);
    expect(canSubmitInvoice(WeeklyInvoiceStatus.SUBMITTED)).toBe(true);
    expect(
      canEditInvoice(WeeklyInvoiceStatus.SUBMITTED, UserRole.ADMIN),
    ).toBe(true);
    expect(
      canEditInvoice(WeeklyInvoiceStatus.APPROVED, UserRole.ADMIN),
    ).toBe(true);
    expect(
      canEditInvoice(WeeklyInvoiceStatus.APPROVED, UserRole.BID_MANAGER),
    ).toBe(false);
    expect(canSubmitInvoice(WeeklyInvoiceStatus.APPROVED)).toBe(false);
    expect(
      canReviewInvoice(WeeklyInvoiceStatus.SUBMITTED, UserRole.ADMIN),
    ).toBe(true);
    expect(
      canReviewInvoice(WeeklyInvoiceStatus.SUBMITTED, UserRole.BID_MANAGER),
    ).toBe(false);
    expect(
      canApproveInvoice(WeeklyInvoiceStatus.SUBMITTED, UserRole.ADMIN),
    ).toBe(true);
    expect(
      canApproveInvoice(WeeklyInvoiceStatus.REVIEWED, UserRole.ADMIN),
    ).toBe(true);
    expect(
      canApproveInvoice(WeeklyInvoiceStatus.REVIEWED, UserRole.BID_MANAGER),
    ).toBe(false);
    expect(adminCanSeeInvoice(WeeklyInvoiceStatus.DRAFT)).toBe(false);
    expect(adminCanSeeInvoice(WeeklyInvoiceStatus.SUBMITTED)).toBe(true);
    expect(adminCanSeeInvoice(WeeklyInvoiceStatus.REVIEWED)).toBe(true);
    expect(adminCanSeeInvoice(WeeklyInvoiceStatus.APPROVED)).toBe(true);
  });

  it('blocks BIDDER access and another manager from a private invoice', () => {
    expect(
      accessBlockReason({
        actorRole: UserRole.BIDDER,
        actorId: 9,
        managerId: 4,
      }),
    ).toBe(WEEKLY_INVOICE_MESSAGES.bidderForbidden);
    expect(
      accessBlockReason({
        actorRole: UserRole.BID_MANAGER,
        actorId: 5,
        managerId: 4,
      }),
    ).toBe(WEEKLY_INVOICE_MESSAGES.notOwner);
    expect(
      accessBlockReason({
        actorRole: UserRole.BID_MANAGER,
        actorId: 4,
        managerId: 4,
      }),
    ).toBeNull();
  });

  it('keeps a disabled bidder who appears in daily submissions', () => {
    expect(invoiceBidderIds([2, 3], [3, 9])).toEqual([2, 3, 9]);
  });
});

describe('standard workdays vs optional weekends', () => {
  it('treats Monday-Friday as standard workdays and Saturday/Sunday as weekends', () => {
    expect(isStandardWorkday('2026-08-24')).toBe(true);
    expect(isStandardWorkday('2026-08-28')).toBe(true);
    expect(isWeekend('2026-08-24')).toBe(false);
    expect(isWeekend('2026-08-29')).toBe(true);
    expect(isWeekend('2026-08-30')).toBe(true);
    expect(weekDayIsos('2026-08-24')).toHaveLength(7);
  });

  it('flags a missing weekday and does not block on missing Saturday or Sunday', () => {
    const week = [
      { reportingDate: '2026-08-24', coverage: DailyCoverageStatus.SUBMITTED },
      { reportingDate: '2026-08-25', coverage: DailyCoverageStatus.SUBMITTED },
      { reportingDate: '2026-08-26', coverage: DailyCoverageStatus.MISSING },
      { reportingDate: '2026-08-27', coverage: DailyCoverageStatus.SUBMITTED },
      { reportingDate: '2026-08-28', coverage: DailyCoverageStatus.SUBMITTED },
      { reportingDate: '2026-08-29', coverage: DailyCoverageStatus.WEEKEND_OFF },
      { reportingDate: '2026-08-30', coverage: DailyCoverageStatus.WEEKEND_OFF },
    ];
    expect(missingCoverageDays(week)).toEqual(['2026-08-26']);
    expect(
      missingDaySubmitBlock({
        missingDates: missingCoverageDays([
          { reportingDate: '2026-08-29', coverage: DailyCoverageStatus.WEEKEND_OFF },
          { reportingDate: '2026-08-30', coverage: DailyCoverageStatus.WEEKEND_OFF },
        ]),
        acknowledgement: null,
      }),
    ).toBeNull();
    expect(
      coverageForDay({
        reportingDate: '2026-08-29',
        submissionStatus: null,
        markedNoActivity: false,
      }),
    ).toBe(DailyCoverageStatus.WEEKEND_OFF);
    expect(
      coverageForDay({
        reportingDate: '2026-08-30',
        submissionStatus: null,
        markedNoActivity: false,
      }),
    ).toBe(DailyCoverageStatus.WEEKEND_OFF);
  });

  it('includes submitted Saturday and Sunday work in weekly defaults and pay', () => {
    const weekday = sumWeeklyDefaults(fabianDays);
    const withWeekend = sumWeeklyDefaults([
      ...fabianDays.slice(0, 5),
      {
        coverage: DailyCoverageStatus.SUBMITTED,
        gmailConfirmedApplicationCount: 20,
        verifiedInterviewCount: 1,
      },
      {
        coverage: DailyCoverageStatus.SUBMITTED,
        gmailConfirmedApplicationCount: 10,
        verifiedInterviewCount: 0,
      },
    ]);
    expect(weekday).toEqual({ applications: 500, interviews: 5 });
    expect(withWeekend).toEqual({ applications: 530, interviews: 6 });
    expect(
      bidderInvoiceAmounts({
        invoiceApplicationCount: 20,
        invoiceInterviewCount: 1,
        invoiceApplicationRate: '0.03',
        invoiceInterviewRate: '1.00',
      }),
    ).toEqual({
      applicationPayAmount: '0.60',
      interviewPayAmount: '1.00',
      totalAmount: '1.60',
      hasBasePay: false,
    });
  });

  it('does not invent weekend counts and keeps submitted weekend zero distinct from no report', () => {
    expect(
      sumWeeklyDefaults([
        {
          coverage: DailyCoverageStatus.WEEKEND_OFF,
          gmailConfirmedApplicationCount: null,
          verifiedInterviewCount: null,
        },
      ]),
    ).toEqual({ applications: 0, interviews: 0 });
    const submittedZero = coverageForDay({
      reportingDate: '2026-08-29',
      submissionStatus: DailySubmissionStatus.SUBMITTED,
      markedNoActivity: false,
    });
    const noReport = coverageForDay({
      reportingDate: '2026-08-29',
      submissionStatus: null,
      markedNoActivity: false,
    });
    expect(submittedZero).toBe(DailyCoverageStatus.SUBMITTED);
    expect(noReport).toBe(DailyCoverageStatus.WEEKEND_OFF);
    expect(submittedZero).not.toBe(noReport);
  });
});

function storedRow() {
  return {
    defaultApplicationCount: 500,
    defaultInterviewCount: 5,
    invoiceApplicationCount: 510,
    invoiceInterviewCount: 4,
  };
}
