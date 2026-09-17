import { ActivityType, rollupByBidderId, snapshotBidderId } from './activity-totals';

describe('activity attribution helpers', () => {
  it('snapshots the current assigned bidder, or null if unassigned', () => {
    expect(snapshotBidderId(12)).toBe(12);
    expect(snapshotBidderId(null)).toBeNull();
  });

  it('aggregates by stored bidderId, including negative corrections', () => {
    const totals = rollupByBidderId([
      { bidderId: 1, type: ActivityType.APPLICATION, delta: 10 },
      { bidderId: 2, type: ActivityType.APPLICATION, delta: 5 },
      { bidderId: 1, type: ActivityType.APPLICATION, delta: -3 },
      { bidderId: 1, type: ActivityType.INTERVIEW, delta: 2 },
      { bidderId: 1, type: ActivityType.RESUME, delta: 4 },
      { bidderId: null, type: ActivityType.APPLICATION, delta: 99 },
    ]);
    expect(totals.get(1)).toEqual({
      resumesGenerated: 4,
      applications: 7,
      interviews: 2,
    });
    expect(totals.get(2)?.applications).toBe(5);
    expect(totals.has(0)).toBe(false);
  });

  it('keeps historic rows on the original bidder after reassignment', () => {
    const recorded = [
      { bidderId: 1, type: ActivityType.APPLICATION, delta: 10 },
      { bidderId: 2, type: ActivityType.APPLICATION, delta: 5 },
    ];
    const afterReassign = recorded.map((row) => ({ ...row }));
    const totals = rollupByBidderId(afterReassign);
    expect(totals.get(1)?.applications).toBe(10);
    expect(totals.get(2)?.applications).toBe(5);
  });
});
