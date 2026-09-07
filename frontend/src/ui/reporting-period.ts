export type PeriodPreset =
  | 'all'
  | 'weekdays'
  | 'today'
  | 'yesterday'
  | 'days7'
  | 'days30'
  | 'months6'
  | 'year1'
  | 'custom'

export const PERIOD_PRESET_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'weekdays', label: 'This week' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'days7', label: 'Recent 7 days' },
  { value: 'days30', label: 'Recent 30 days' },
  { value: 'months6', label: 'Recent 6 months' },
  { value: 'year1', label: 'Recent 1 year' },
  { value: 'custom', label: 'Custom' },
]

export type DateRange = {
  from: Date
  to: Date
  label: string
}

function startOfLocalDay(reference = new Date()) {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(reference: Date, days: number) {
  const date = new Date(reference)
  date.setDate(date.getDate() + days)
  return date
}

/** Local Monday 00:00 inclusive through next Monday 00:00 exclusive. */
function startOfMonday(reference: Date) {
  const date = startOfLocalDay(reference)
  const day = date.getDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + offset)
  return date
}

export function weekRange(preset: 'current' | 'previous'): DateRange {
  const start = startOfMonday(new Date())
  if (preset === 'previous') {
    start.setDate(start.getDate() - 7)
  }
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return {
    from: start,
    to: end,
    label: formatRangeLabel(start, end),
  }
}

export function customRange(fromDate: string, toDate: string): DateRange {
  if (!fromDate || !toDate) {
    return presetRange('today')
  }
  const from = parseLocalDate(fromDate)
  const to = parseLocalDate(toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return presetRange('today')
  }
  to.setDate(to.getDate() + 1)
  return {
    from,
    to,
    label: formatRangeLabel(from, to),
  }
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toIsoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function inclusiveToDate(toExclusive: Date) {
  return toIsoDate(addDays(toExclusive, -1))
}

export function isWeekend(isoDate: string) {
  const day = parseLocalDate(isoDate).getDay()
  return day === 0 || day === 6
}

export function isStandardWorkday(isoDate: string) {
  return !isWeekend(isoDate)
}

export function formatRangeLabel(from: Date, toExclusive: Date) {
  const end = addDays(toExclusive, -1)
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  return `${fmt(from)} – ${fmt(end)}`
}

function presetRange(preset: Exclude<PeriodPreset, 'custom'>): DateRange {
  const today = startOfLocalDay()
  const tomorrow = addDays(today, 1)
  if (preset === 'all') {
    const from = new Date(2000, 0, 1)
    return { from, to: tomorrow, label: 'All time' }
  }
  if (preset === 'weekdays') {
    const from = startOfMonday(today)
    const to = addDays(from, 5)
    return { from, to, label: formatRangeLabel(from, to) }
  }
  if (preset === 'today') {
    return { from: today, to: tomorrow, label: formatRangeLabel(today, tomorrow) }
  }
  if (preset === 'yesterday') {
    const from = addDays(today, -1)
    return { from, to: today, label: formatRangeLabel(from, today) }
  }
  if (preset === 'days7') {
    const from = addDays(today, -6)
    return { from, to: tomorrow, label: formatRangeLabel(from, tomorrow) }
  }
  if (preset === 'days30') {
    const from = addDays(today, -29)
    return { from, to: tomorrow, label: formatRangeLabel(from, tomorrow) }
  }
  if (preset === 'months6') {
    const from = startOfLocalDay()
    from.setMonth(from.getMonth() - 6)
    return { from, to: tomorrow, label: formatRangeLabel(from, tomorrow) }
  }
  if (preset === 'year1') {
    const from = startOfLocalDay()
    from.setFullYear(from.getFullYear() - 1)
    return { from, to: tomorrow, label: formatRangeLabel(from, tomorrow) }
  }
  const from = startOfLocalDay()
  from.setFullYear(from.getFullYear() - 1)
  return { from, to: tomorrow, label: formatRangeLabel(from, tomorrow) }
}

export function resolveRange(
  preset: PeriodPreset,
  fromDate: string,
  toDate: string,
): DateRange {
  if (preset === 'custom') {
    return customRange(fromDate, toDate)
  }
  return presetRange(preset)
}

export function datesForPreset(preset: PeriodPreset, fromDate: string, toDate: string) {
  const range = resolveRange(preset, fromDate, toDate)
  return {
    fromDate: toIsoDate(range.from),
    toDate: inclusiveToDate(range.to),
  }
}

export function rangeQuery(range: DateRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  }
}

export function occurredAtForDate(dateValue: string) {
  return `${dateValue}T12:00:00.000`
}
