import {
  hasApplicationColumnFilters,
  matchesApplicationColumnFilters,
} from './application-column-filter';

describe('application column filters', () => {
  const row = {
    companyName: 'CareTalk Health',
    jobTitle: 'Patient Engagement Analyst',
    source: 'linkedin',
    status: 'applied',
    appliedAt: '2026-09-02T14:30:00.000Z',
    bidderName: 'Yel',
  };

  it('treats empty filters as a match', () => {
    expect(hasApplicationColumnFilters({})).toBe(false);
    expect(matchesApplicationColumnFilters(row, {})).toBe(true);
  });

  it('matches contains across the whole record, not an exact page slice', () => {
    expect(matchesApplicationColumnFilters(row, { company: 'care' })).toBe(true);
    expect(matchesApplicationColumnFilters(row, { position: 'engagement' })).toBe(
      true,
    );
    expect(matchesApplicationColumnFilters(row, { bidderName: 'ye' })).toBe(true);
    expect(matchesApplicationColumnFilters(row, { company: 'ibm' })).toBe(false);
  });
});
