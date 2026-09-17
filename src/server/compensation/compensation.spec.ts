import { bidderPay, managerPay, payCents, formatUsdFromCents, sumUsd } from './compensation-money';
import {
  canMarkPaid,
  canMarkReviewed,
  canModifyIndividualBidderRates,
  canRecalculate,
  canViewIndividualBidderRateConfig,
  countPayableInterviews,
  isPayableInterviewStatus,
  PAYABLE_INTERVIEW_STATUSES,
  PaymentStatus,
  rateCoversPeriod,
  resolveBidderRates,
} from './compensation.rules';

describe('compensation money', () => {
  it('500 apps at $0.03 and 5 interviews at $1.00 equals $20.00 with no base pay', () => {
    const result = bidderPay({
      applicationCount: 500,
      interviewCount: 5,
      applicationRate: '0.03',
      interviewRate: '1.00',
    });
    expect(result.applicationPayAmount).toBe('15.00');
    expect(result.interviewPayAmount).toBe('5.00');
    expect(result.totalAmount).toBe('20.00');
    expect(result.hasBasePay).toBe(false);
  });

  it('zero activity pays $0.00', () => {
    const result = bidderPay({
      applicationCount: 0,
      interviewCount: 0,
      applicationRate: '0.03',
      interviewRate: '1.00',
    });
    expect(result.totalAmount).toBe('0.00');
  });

  it('negative application corrections reduce pay', () => {
    const result = bidderPay({
      applicationCount: -10,
      interviewCount: 0,
      applicationRate: '0.03',
      interviewRate: '1.00',
    });
    expect(result.applicationPayAmount).toBe('-0.30');
    expect(result.totalAmount).toBe('-0.30');
  });

  it('manager weekly total equals the fixed salary', () => {
    expect(managerPay('80.00')).toEqual({
      weeklySalaryRate: '80.00',
      totalAmount: '80.00',
    });
  });

  it('payroll summary adds bidder pay and manager salaries in cents', () => {
    expect(sumUsd(['180.00', '80.00'])).toBe('260.00');
  });
});

describe('payable interviews', () => {
  const week = {
    from: new Date('2026-08-24T00:00:00.000Z'),
    to: new Date('2026-08-31T00:00:00.000Z'),
  };

  it('pays scheduled and completed, not cancelled or no-show', () => {
    expect(isPayableInterviewStatus('SCHEDULED')).toBe(true);
    expect(isPayableInterviewStatus('COMPLETED')).toBe(true);
    expect(isPayableInterviewStatus('CANCELLED')).toBe(false);
    expect(isPayableInterviewStatus('NO_SHOW')).toBe(false);
    expect(PAYABLE_INTERVIEW_STATUSES).toEqual(['SCHEDULED', 'COMPLETED']);
  });

  it('does not pay cancelled or no-show interviews', () => {
    const rows = [
      { bidderId: 1, startsAt: '2026-08-25T15:00:00.000Z', status: 'CANCELLED' },
      { bidderId: 1, startsAt: '2026-08-26T15:00:00.000Z', status: 'NO_SHOW' },
      { bidderId: 1, startsAt: '2026-08-27T15:00:00.000Z', status: 'SCHEDULED' },
      { bidderId: 1, startsAt: '2026-08-28T15:00:00.000Z', status: 'COMPLETED' },
    ];
    expect(countPayableInterviews(rows, 1, week.from, week.to)).toBe(2);
  });

  it('does not transfer interviews after candidate reassignment', () => {
    const rows = [
      {
        bidderId: 1,
        startsAt: '2026-08-25T15:00:00.000Z',
        status: 'SCHEDULED',
      },
    ];
    expect(countPayableInterviews(rows, 1, week.from, week.to)).toBe(1);
    expect(countPayableInterviews(rows, 2, week.from, week.to)).toBe(0);
  });
});

describe('payment snapshots', () => {
  it('draft can be recalculated; reviewed/paid stay locked', () => {
    expect(canRecalculate(PaymentStatus.DRAFT)).toBe(true);
    expect(canRecalculate(PaymentStatus.REVIEWED)).toBe(false);
    expect(canRecalculate(PaymentStatus.PAID)).toBe(false);
    expect(canMarkReviewed(PaymentStatus.DRAFT)).toBe(true);
    expect(canMarkPaid(PaymentStatus.REVIEWED)).toBe(true);
    expect(canMarkPaid(PaymentStatus.DRAFT)).toBe(false);
  });

  it('a later rate does not cover an earlier week', () => {
    expect(
      rateCoversPeriod(
        {
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveTo: null,
        },
        new Date('2026-08-24T00:00:00.000Z'),
      ),
    ).toBe(false);
    expect(
      rateCoversPeriod(
        {
          effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
        },
        new Date('2026-08-24T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('payCents uses integer cents', () => {
    expect(formatUsdFromCents(payCents(1, '1.00'))).toBe('1.00');
  });
});

describe('individual vs default bidder rates', () => {
  const weekStart = new Date('2026-08-24T00:00:00.000Z');
  const global = [
    {
      applicationRate: '0.03',
      interviewRate: '1.00',
      effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      effectiveTo: null,
    },
  ];
  const fabianOverride = {
    bidderId: 1,
    applicationRate: '0.04',
    interviewRate: '1.50',
    effectiveFrom: new Date('2026-08-30T00:00:00.000Z'),
    effectiveTo: null as Date | null,
  };

  it('uses global .03 / 1.00 when there is no individual override', () => {
    expect(
      resolveBidderRates({
        bidderId: 2,
        periodStart: weekStart,
        individualRates: [fabianOverride],
        globalRates: global,
      }),
    ).toEqual({
      applicationRate: '0.03',
      interviewRate: '1.00',
      source: 'default',
    });
  });

  it('uses Fabian individual .04 / 1.50 when an override covers the week', () => {
    expect(
      resolveBidderRates({
        bidderId: 1,
        periodStart: new Date('2026-08-31T00:00:00.000Z'),
        individualRates: [fabianOverride],
        globalRates: global,
      }),
    ).toEqual({
      applicationRate: '0.04',
      interviewRate: '1.50',
      source: 'individual',
    });
  });

  it('500 apps and 5 interviews at Fabian override equals $27.50', () => {
    const rates = resolveBidderRates({
      bidderId: 1,
      periodStart: new Date('2026-08-31T00:00:00.000Z'),
      individualRates: [fabianOverride],
      globalRates: global,
    });
    const result = bidderPay({
      applicationCount: 500,
      interviewCount: 5,
      applicationRate: rates!.applicationRate,
      interviewRate: rates!.interviewRate,
    });
    expect(result.applicationPayAmount).toBe('20.00');
    expect(result.interviewPayAmount).toBe('7.50');
    expect(result.totalAmount).toBe('27.50');
    expect(result.hasBasePay).toBe(false);
  });

  it('another bidder without override still earns $20 at global rates', () => {
    const rates = resolveBidderRates({
      bidderId: 2,
      periodStart: new Date('2026-08-31T00:00:00.000Z'),
      individualRates: [fabianOverride],
      globalRates: global,
    });
    const result = bidderPay({
      applicationCount: 500,
      interviewCount: 5,
      applicationRate: rates!.applicationRate,
      interviewRate: rates!.interviewRate,
    });
    expect(result.totalAmount).toBe('20.00');
  });

  it('a later global rate does not replace an active individual override', () => {
    const laterGlobal = [
      {
        applicationRate: '0.05',
        interviewRate: '2.00',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
        effectiveTo: null,
      },
      {
        applicationRate: '0.03',
        interviewRate: '1.00',
        effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
        effectiveTo: new Date('2026-09-01T00:00:00.000Z'),
      },
    ];
    expect(
      resolveBidderRates({
        bidderId: 1,
        periodStart: new Date('2026-09-01T00:00:00.000Z'),
        individualRates: [fabianOverride],
        globalRates: laterGlobal,
      }),
    ).toEqual({
      applicationRate: '0.04',
      interviewRate: '1.50',
      source: 'individual',
    });
  });

  it('ending an individual override returns the bidder to the applicable global rate', () => {
    const ended = {
      ...fabianOverride,
      effectiveTo: new Date('2026-09-15T00:00:00.000Z'),
    };
    expect(
      resolveBidderRates({
        bidderId: 1,
        periodStart: new Date('2026-09-15T00:00:00.000Z'),
        individualRates: [ended],
        globalRates: global,
      }),
    ).toEqual({
      applicationRate: '0.03',
      interviewRate: '1.00',
      source: 'default',
    });
  });

  it('overlapping individual periods use the later effectiveFrom row only', () => {
    expect(
      resolveBidderRates({
        bidderId: 1,
        periodStart: new Date('2026-09-20T00:00:00.000Z'),
        individualRates: [
          {
            bidderId: 1,
            applicationRate: '0.04',
            interviewRate: '1.50',
            effectiveFrom: new Date('2026-08-30T00:00:00.000Z'),
            effectiveTo: new Date('2026-09-15T00:00:00.000Z'),
          },
          {
            bidderId: 1,
            applicationRate: '0.05',
            interviewRate: '2.00',
            effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
            effectiveTo: null,
          },
        ],
        globalRates: global,
      }),
    ).toEqual({
      applicationRate: '0.05',
      interviewRate: '2.00',
      source: 'individual',
    });
  });

  it('reviewed/paid snapshots stay locked after a later individual rate change', () => {
    expect(canRecalculate(PaymentStatus.REVIEWED)).toBe(false);
    expect(canRecalculate(PaymentStatus.PAID)).toBe(false);
  });
});

describe('individual bidder rate permissions', () => {
  it('BID_MANAGER cannot modify individual bidder rates', () => {
    expect(canModifyIndividualBidderRates({ role: 'BID_MANAGER' })).toBe(false);
  });

  it('BIDDER cannot modify individual rates', () => {
    expect(canModifyIndividualBidderRates({ role: 'BIDDER' })).toBe(false);
  });

  it('ADMIN can modify individual bidder rates', () => {
    expect(canModifyIndividualBidderRates({ role: 'ADMIN' })).toBe(true);
  });

  it('bidder cannot read another bidder compensation configuration', () => {
    expect(
      canViewIndividualBidderRateConfig({ role: 'BIDDER', id: 1 }, 2),
    ).toBe(false);
    expect(
      canViewIndividualBidderRateConfig({ role: 'BIDDER', id: 1 }, 1),
    ).toBe(false);
    expect(
      canViewIndividualBidderRateConfig({ role: 'ADMIN', id: 9 }, 2),
    ).toBe(true);
    expect(
      canViewIndividualBidderRateConfig({ role: 'BID_MANAGER', id: 3 }, 1),
    ).toBe(false);
  });
});
