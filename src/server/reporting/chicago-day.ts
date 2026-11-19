/** Daily website counts use the Chicago calendar, same as the dashboard clock. */
export const REPORTING_TIME_ZONE = 'America/Chicago';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC calendar date of an instant. Jira's from/to dates follow this clock. */
export function utcDateKey(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function reportingDayKey(
  value: Date,
  timeZone = REPORTING_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Chicago midnight of `isoDate`, through the next Chicago midnight. */
export function reportingDayRange(
  isoDate: string,
  timeZone = REPORTING_TIME_ZONE,
) {
  const match = DATE_ONLY.exec(isoDate.trim());
  if (!match) {
    throw new Error('Reporting date must be YYYY-MM-DD.');
  }
  const reportingDate = `${match[1]}-${match[2]}-${match[3]}`;
  const from = zonedMidnight(reportingDate, timeZone);
  const to = zonedMidnight(nextIsoDate(reportingDate), timeZone);
  return { from, to, reportingDate };
}

function nextIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
}

function zonedMidnight(isoDate: string, timeZone: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const first = timeZoneOffsetMs(utc, timeZone);
  const corrected = new Date(utc.getTime() - first);
  const second = timeZoneOffsetMs(corrected, timeZone);
  return new Date(utc.getTime() - second);
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    pick('hour') % 24,
    pick('minute'),
    pick('second'),
  );
  return asUtc - date.getTime();
}
