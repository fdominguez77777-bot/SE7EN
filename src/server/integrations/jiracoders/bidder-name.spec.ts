import {
  countApplicationsByBidderName,
  countsTowardApplicationTotal,
  matchBidderIdByName,
  normalizeBidderName,
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
});

describe('application status counting', () => {
  it('does not count draft applications', () => {
    expect(countsTowardApplicationTotal('draft')).toBe(false);
    expect(countsTowardApplicationTotal('Draft')).toBe(false);
    expect(countsTowardApplicationTotal('applied')).toBe(true);
    expect(countsTowardApplicationTotal('Applied')).toBe(true);
  });
});
