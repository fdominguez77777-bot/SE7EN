import {
  assignDenseRanks,
  canSeeTeamDashboard,
  countInRange,
  dailyCounts,
  previousWindow,
  rollupTeamBidderPerformance,
  startOfLocalDay,
} from './dashboard-team';
import { UserRole } from '../users/user-role.enum';

describe('dashboard team visibility', () => {
  it('lets admins, bid managers, and bidders see team dashboard data', () => {
    expect(canSeeTeamDashboard(UserRole.ADMIN)).toBe(true);
    expect(canSeeTeamDashboard(UserRole.BID_MANAGER)).toBe(true);
    expect(canSeeTeamDashboard(UserRole.BIDDER)).toBe(true);
  });

  it('includes every bidder even when some have zero activity', () => {
    const rows = rollupTeamBidderPerformance(
      [
        { id: 1, name: 'Ada', email: 'ada@example.com', isActive: true },
        { id: 2, name: 'Yel', email: 'yel@example.com', isActive: true },
      ],
      [{ bidderId: 1 }, { bidderId: 1 }],
      [{ bidderId: 1 }],
    );
    expect(rows).toEqual([
      {
        id: 1,
        name: 'Ada',
        email: 'ada@example.com',
        isActive: true,
        applications: 2,
        interviews: 1,
      },
      {
        id: 2,
        name: 'Yel',
        email: 'yel@example.com',
        isActive: true,
        applications: 0,
        interviews: 0,
      },
    ]);
  });

  it('ranks bidders by count with ties sharing a dense rank', () => {
    expect(assignDenseRanks([10, 10, 4, 0])).toEqual([1, 1, 2, 3]);
    expect(assignDenseRanks([0, 3, 3])).toEqual([2, 1, 1]);
  });

  it('counts the previous window and daily buckets without inventing rows', () => {
    const from = new Date(2026, 7, 24);
    const to = new Date(2026, 7, 31);
    const prev = previousWindow(from, to);
    expect(prev.from).toEqual(new Date(2026, 7, 17));
    expect(prev.to).toEqual(from);
    const today = startOfLocalDay(new Date(2026, 7, 26, 15));
    expect(
      countInRange([new Date(2026, 7, 26, 9)], today, new Date(2026, 7, 27)),
    ).toBe(1);
    expect(dailyCounts([new Date(2026, 7, 25, 12)], from, to)).toEqual([
      { date: '2026-08-24', applications: 0 },
      { date: '2026-08-25', applications: 1 },
      { date: '2026-08-26', applications: 0 },
      { date: '2026-08-27', applications: 0 },
      { date: '2026-08-28', applications: 0 },
      { date: '2026-08-29', applications: 0 },
      { date: '2026-08-30', applications: 0 },
    ]);
  });
});
