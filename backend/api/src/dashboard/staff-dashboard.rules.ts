export const STAFF_DASHBOARD_WORKFLOW = [
  'Profiles',
  'Bidders',
  'Applications',
  'Interviews',
] as const;

export function isStaffDashboardPayLabel(label: string) {
  return /pay|payout|bonus|payroll|earnings|compensation|salary/i.test(label);
}
