import {
  STAFF_DASHBOARD_WORKFLOW,
  isStaffDashboardPayLabel,
} from './staff-dashboard.rules';

describe('staff dashboard operations overview', () => {
  it('uses a four-stage operations workflow with no Performance Pay', () => {
    expect([...STAFF_DASHBOARD_WORKFLOW]).toEqual([
      'Profiles',
      'Bidders',
      'Applications',
      'Interviews',
    ]);
    expect(STAFF_DASHBOARD_WORKFLOW).not.toContain('Performance Pay');
  });

  it('rejects compensation and dollar-pay metric labels on the staff dashboard', () => {
    expect(isStaffDashboardPayLabel('Performance Pay')).toBe(true);
    expect(isStaffDashboardPayLabel('Bidder Performance Pay')).toBe(true);
    expect(isStaffDashboardPayLabel('Weekly bidder payout')).toBe(true);
    expect(isStaffDashboardPayLabel('Application bonuses')).toBe(true);
    expect(isStaffDashboardPayLabel('Applications')).toBe(false);
    expect(isStaffDashboardPayLabel('Interview schedules')).toBe(false);
  });
});
