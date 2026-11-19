import { reportingDayKey, reportingDayRange, utcDateKey } from './chicago-day';

describe('Chicago reporting day', () => {
  it('starts Nov 17 at Chicago midnight', () => {
    const range = reportingDayRange('2026-11-17');
    expect(range.from.toISOString()).toBe('2026-11-17T06:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-18T06:00:00.000Z');
  });

  it('keeps late Chicago evening on the same reporting day', () => {
    expect(reportingDayKey(new Date('2026-11-18T02:00:00.000Z'))).toBe(
      '2026-11-17',
    );
    expect(reportingDayKey(new Date('2026-11-18T06:00:00.000Z'))).toBe(
      '2026-11-18',
    );
  });

  it('asks Jira for both UTC dates inside a Chicago day', () => {
    const range = reportingDayRange('2026-11-17');
    expect(utcDateKey(range.from)).toBe('2026-11-17');
    expect(utcDateKey(new Date(range.to.getTime() - 1))).toBe('2026-11-18');
  });

  it('uses daylight time in July', () => {
    expect(reportingDayRange('2026-07-17').from.toISOString()).toBe(
      '2026-07-17T05:00:00.000Z',
    );
  });
});
