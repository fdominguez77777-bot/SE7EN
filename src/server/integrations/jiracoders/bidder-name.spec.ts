import {
  countApplicationsByBidderName,
  countsFromBidderStats,
  countsTowardApplicationTotal,
  jiraStatsRange,
  matchBidderIdByEmail,
  creditInterviewBidderId,
  matchBidderIdByName,
  normalizeBidderEmail,
  normalizeBidderName,
  sumCountMap,
} from './bidder-name';

describe('bidder name matching', () => {
  const bidders = [
    { id: 8, name: 'Yel' },
    { id: 3, name: 'Ada Lovelace' },
  ];

  it('matches local bidders by trimmed, case-insensitive name', () => {
    expect(normalizeBidderName('  Yel ')).toBe('yel');
    expect(matchBidderIdByName('yel', bidders)).toBe(8);
    expect(matchBidderIdByName('Ada  Lovelace', bidders)).toBe(3);
    expect(matchBidderIdByName('Unknown', bidders)).toBeNull();
  });

  it('credits admin and bid manager names the same way as bidders', () => {
    const team = [
      { id: 2, name: 'admin' },
      { id: 9, name: 'Vincent' },
      { id: 4, name: 'Joe' },
    ];
    expect(matchBidderIdByName('admin', team)).toBe(2);
    expect(matchBidderIdByName('Vincent', team)).toBe(9);
    const counts = countApplicationsByBidderName(
      [
        { bidderName: 'Joe', status: 'applied' },
        { bidderName: 'admin', status: 'applied' },
        { bidderName: 'Vincent', status: 'applied' },
        { bidderName: 'admin', status: 'draft' },
      ],
      team,
    );
    expect(counts.get(4)).toBe(1);
    expect(counts.get(2)).toBe(2);
    expect(counts.get(9)).toBe(1);
  });

  it('matches interviews onto the local bidder whose Gmail matches', () => {
    const people = [
      { id: 4, email: 'cameronhicks10001@gmail.com' },
      { id: 6, email: 'eo1425613@gmail.com' },
    ];
    expect(normalizeBidderEmail('  EO1425613@gmail.com ')).toBe(
      'eo1425613@gmail.com',
    );
    expect(matchBidderIdByEmail('eo1425613@gmail.com', people)).toBe(6);
    expect(matchBidderIdByEmail('CameronHicks10001@Gmail.com', people)).toBe(4);
    expect(
      matchBidderIdByEmail('fabiandominguez0420@gmail.com', people),
    ).toBeNull();
  });

  it('credits interviews from the assigned calendar, then Gmail', () => {
    const people = [
      { id: 7, email: 'barquerisdavid@gmail.com' },
      { id: 6, email: 'eo1425613@gmail.com' },
    ];
    expect(
      creditInterviewBidderId(
        { bidderId: 7, email: 'fabiandominguez0420@gmail.com' },
        people,
      ),
    ).toBe(7);
    expect(
      creditInterviewBidderId(
        { bidderId: null, email: 'eo1425613@gmail.com' },
        people,
      ),
    ).toBe(6);
    expect(
      creditInterviewBidderId(
        { bidderId: null, email: 'unknown@gmail.com' },
        people,
      ),
    ).toBeNull();
  });

  it('counts applications onto the local bidder id, not the upstream id', () => {
    const counts = countApplicationsByBidderName(
      [
        { bidderName: 'Yel' },
        { bidderName: 'yel' },
        { bidderName: 'Ada Lovelace' },
        { bidderName: 'Night Owl Bot' },
      ],
      bidders,
    );
    expect(counts.get(8)).toBe(2);
    expect(counts.get(3)).toBe(1);
    expect(counts.size).toBe(2);
  });

  it('assigns exact Jira stats onto local bidders by name and ignores unmatched names', () => {
    const local = [
      { id: 4, name: 'Joe' },
      { id: 5, name: 'Saad' },
      { id: 6, name: 'Yel' },
      { id: 7, name: 'Manni' },
    ];
    const counts = countsFromBidderStats(
      [
        { name: 'Manni', applicationsCount: 70 },
        { name: 'admin', applicationsCount: 2 },
        { name: 'saad', applicationsCount: 47 },
        { name: 'Joe', applicationsCount: 98 },
        { name: 'Vincent', applicationsCount: 17 },
        { name: 'Yel', applicationsCount: 44 },
      ],
      local,
    );
    expect(counts.get(4)).toBe(98);
    expect(counts.get(5)).toBe(47);
    expect(counts.get(6)).toBe(44);
    expect(counts.get(7)).toBe(70);
    expect(sumCountMap(counts)).toBe(259);
  });

  it('formats exclusive Chicago windows as inclusive MM/DD/YYYY stats dates', () => {
    expect(
      jiraStatsRange(
        new Date('2026-09-16T05:00:00.000Z'),
        new Date('2026-09-17T05:00:00.000Z'),
      ),
    ).toEqual({
      fromDate: '09/16/2026',
      toDate: '09/16/2026',
    });
    expect(
      jiraStatsRange(
        new Date('2026-09-14T05:00:00.000Z'),
        new Date('2026-09-21T05:00:00.000Z'),
      ),
    ).toEqual({
      fromDate: '09/14/2026',
      toDate: '09/20/2026',
    });
  });
});

describe('application status counting', () => {
  it('counts applied and draft applications', () => {
    expect(countsTowardApplicationTotal('draft')).toBe(true);
    expect(countsTowardApplicationTotal('Draft')).toBe(true);
    expect(countsTowardApplicationTotal('applied')).toBe(true);
    expect(countsTowardApplicationTotal('Applied')).toBe(true);
    expect(countsTowardApplicationTotal('interviewing')).toBe(false);
    expect(countsTowardApplicationTotal('')).toBe(false);
  });

  it('credits bidder totals from applied and draft rows', () => {
    const local = [
      { id: 8, name: 'Yel' },
      { id: 3, name: 'Ada Lovelace' },
    ];
    const counts = countApplicationsByBidderName(
      [
        { bidderName: 'Yel', status: 'applied' },
        { bidderName: 'Yel', status: 'Applied' },
        { bidderName: 'Yel', status: 'draft' },
        { bidderName: 'Yel', status: 'Draft' },
        { bidderName: 'Ada Lovelace', status: 'draft' },
        { bidderName: 'Ada Lovelace', status: 'interviewing' },
      ],
      local,
    );
    expect(counts.get(8)).toBe(4);
    expect(counts.get(3)).toBe(1);
  });
});
