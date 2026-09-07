/**
 * Reporting weeks are Monday 00:00 (inclusive) through the following
 * Monday 00:00 (exclusive), i.e. Monday–Sunday in the local timezone.
 */
export function mondaySundayWeek(reference = new Date()) {
  const from = new Date(reference);
  from.setHours(0, 0, 0, 0);
  const day = from.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  from.setDate(from.getDate() + offset);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}
