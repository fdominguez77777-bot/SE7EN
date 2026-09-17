import { mondaySundayWeek } from '../reporting/week-range';

describe('mondaySundayWeek', () => {
  it('starts Monday and ends the following Monday exclusive', () => {
    const { from, to } = mondaySundayWeek(new Date('2026-08-30T15:00:00'));
    expect(from.getDay()).toBe(1);
    expect(to.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(to.getDay()).toBe(1);
  });
});
