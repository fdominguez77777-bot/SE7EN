import type { DateRange } from '../../ui/reporting-period'
import { formatRangeLabel } from '../../ui/reporting-period'

export function startOfLocalDay(reference = new Date()) {
  const date = new Date(reference)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function previousEquivalentRange(range: DateRange): DateRange {
  const duration = range.to.getTime() - range.from.getTime()
  const to = new Date(range.from)
  const from = new Date(range.from.getTime() - duration)
  return {
    from,
    to,
    label: formatRangeLabel(from, to),
  }
}

export function inRange(iso: string, from: Date, to: Date) {
  const time = new Date(iso).getTime()
  return time >= from.getTime() && time < to.getTime()
}

export function percentChange(current: number, previous: number) {
  if (previous === 0 && current === 0) {
    return null
  }
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function interviewRate(interviews: number, applications: number) {
  if (applications <= 0) {
    return null
  }
  return Math.round((interviews / applications) * 1000) / 10
}

export function formatRate(rate: number | null) {
  if (rate == null) {
    return '—'
  }
  return `${rate.toFixed(1)}%`
}

export function formatSignedPercent(value: number | null) {
  if (value == null) {
    return null
  }
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : value
  const label = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1)
  return `${value > 0 ? '+' : value < 0 ? '' : ''}${label}%`
}

export type DayPoint = {
  date: Date
  key: string
  label: string
  value: number
}

export function dailySeries(
  timestamps: string[],
  from: Date,
  to: Date,
): DayPoint[] {
  const days: DayPoint[] = []
  const cursor = startOfLocalDay(from)
  const end = startOfLocalDay(to)
  while (cursor < end) {
    const next = addDays(cursor, 1)
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    days.push({
      date: new Date(cursor),
      key,
      label: cursor.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      value: 0,
    })
    cursor.setTime(next.getTime())
  }
  const index = new Map(days.map((day, i) => [day.key, i]))
  for (const iso of timestamps) {
    const date = new Date(iso)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const at = index.get(key)
    if (at != null) {
      days[at].value += 1
    }
  }
  return days
}

export function assignDenseRanks(values: number[]) {
  const sorted = [...values].sort((a, b) => b - a)
  const rankByValue = new Map<number, number>()
  let rank = 0
  let previous: number | null = null
  for (const value of sorted) {
    if (value !== previous) {
      rank += 1
      previous = value
      rankByValue.set(value, rank)
    }
  }
  return values.map((value) => rankByValue.get(value) ?? values.length)
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
