export const INTERVIEW_TIME_ZONE = 'America/Chicago'

export const HOUR_START = 7
export const HOUR_END = 19
export const CALENDAR_HOURS = Array.from(
  { length: HOUR_END - HOUR_START },
  (_, index) => HOUR_START + index,
)
export const HOUR_HEIGHT = 48
export const DAY_MINUTES = 24 * 60

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

type ChicagoParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: string
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function chicagoParts(date: Date): ChicagoParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '0'
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    second: Number(read('second')),
    weekday: read('weekday'),
  }
}

function ymdFromParts(parts: Pick<ChicagoParts, 'year' | 'month' | 'day'>) {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function chicagoDateKey(date: Date) {
  return ymdFromParts(chicagoParts(date))
}

export function chicagoWallToUtc(ymd: string, hour = 0, minute = 0, second = 0) {
  const [year, month, day] = ymd.split('-').map(Number)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  const shown = chicagoParts(new Date(asUtc))
  const shownAsUtc = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  )
  return new Date(asUtc + (asUtc - shownAsUtc))
}

export function startOfChicagoDay(reference: Date) {
  return chicagoWallToUtc(chicagoDateKey(reference), 0, 0, 0)
}

export function chicagoMinutes(date: Date) {
  const parts = chicagoParts(date)
  return parts.hour * 60 + parts.minute + parts.second / 60
}

export function chicagoTimeZoneName(date = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    timeZoneName: 'short',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value
  return name || 'CT'
}

export function parseCalendarInstant(value: string, allDay = false) {
  if (allDay) {
    const date = value.slice(0, 10)
    return chicagoWallToUtc(date, 0, 0, 0)
  }
  if (/[zZ]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value)
  }
  const [date, time = '00:00:00'] = value.split('T')
  const [hour, minute, second] = time.split(':').map(Number)
  return chicagoWallToUtc(date, hour || 0, minute || 0, second || 0)
}

function dateKeyFromValue(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : chicagoDateKey(parseCalendarInstant(value))
}

function shiftYmd(ymd: string, days: number) {
  const [year, month, day] = ymd.split('-').map(Number)
  const shifted = chicagoParts(new Date(Date.UTC(year, month - 1, day + days, 12)))
  return ymdFromParts(shifted)
}

export function startOfWeek(reference: Date) {
  const parts = chicagoParts(reference)
  const weekday = WEEKDAY_INDEX[parts.weekday] ?? 0
  return chicagoWallToUtc(shiftYmd(ymdFromParts(parts), -weekday), 0, 0, 0)
}

export function addDays(from: Date, days: number) {
  return chicagoWallToUtc(shiftYmd(chicagoDateKey(from), days), 0, 0, 0)
}

export function weekDays(from: Date) {
  return Array.from({ length: 7 }, (_, index) => addDays(from, index))
}

export function sameDay(left: Date, right: Date) {
  return chicagoDateKey(left) === chicagoDateKey(right)
}

export function formatWeekLabel(from: Date) {
  const to = addDays(from, 6)
  const fromParts = chicagoParts(from)
  const toParts = chicagoParts(to)
  const fromLabel = from.toLocaleString('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  })
  const toLabel = to.toLocaleString('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    month: toParts.month === fromParts.month ? undefined : 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${fromLabel} – ${toLabel}`
}

export function formatDayHead(date: Date) {
  return {
    weekday: date.toLocaleString('en-US', {
      timeZone: INTERVIEW_TIME_ZONE,
      weekday: 'short',
    }).toUpperCase(),
    monthDay: date.toLocaleString('en-US', {
      timeZone: INTERVIEW_TIME_ZONE,
      month: 'numeric',
      day: 'numeric',
    }),
  }
}

export function formatHour(hour: number) {
  if (hour === 0) {
    return '12 AM'
  }
  if (hour < 12) {
    return `${hour} AM`
  }
  if (hour === 12) {
    return '12 PM'
  }
  return `${hour - 12} PM`
}

const clockOpts: Intl.DateTimeFormatOptions = {
  timeZone: INTERVIEW_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
}

export function formatEventTime(startIso: string, endIso: string | null, allDay = false) {
  if (allDay) {
    return 'All day'
  }
  const start = parseCalendarInstant(startIso)
  const end = endIso ? parseCalendarInstant(endIso) : null
  if (!end || Number.isNaN(end.getTime())) {
    return start.toLocaleTimeString('en-US', clockOpts)
  }
  return `${start.toLocaleTimeString('en-US', clockOpts)} – ${end.toLocaleTimeString('en-US', clockOpts)}`
}

export function formatEventWhen(startIso: string, endIso: string | null, allDay = false) {
  const start = parseCalendarInstant(startIso, allDay)
  const end = endIso ? parseCalendarInstant(endIso, allDay) : null
  const zone = chicagoTimeZoneName(start)
  const dateLabel = start.toLocaleString('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (allDay) {
    return { dateLabel, timeLabel: 'All day', zone, duration: '' }
  }
  const timeLabel = formatEventTime(startIso, endIso, false)
  let duration = ''
  if (end && !Number.isNaN(end.getTime())) {
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      duration = rest ? `${hours}h ${rest}m` : `${hours} hour${hours === 1 ? '' : 's'}`
    } else if (minutes > 0) {
      duration = `${minutes} min`
    }
  }
  return { dateLabel, timeLabel, zone, duration }
}

export function minutesFromStart(iso: string, allDay = false) {
  return chicagoMinutes(parseCalendarInstant(iso, allDay))
}

export function layoutFromMinutes(startMin: number, endMin: number, hourHeight = HOUR_HEIGHT) {
  const rangeStart = HOUR_START * 60
  const rangeEnd = HOUR_END * 60
  if (endMin <= rangeStart || startMin >= rangeEnd) {
    return null
  }
  const topMin = Math.max(startMin, rangeStart)
  const bottomMin = Math.min(Math.max(endMin, topMin + 15), rangeEnd)
  return {
    top: ((topMin - rangeStart) / 60) * hourHeight,
    height: Math.max(18, ((bottomMin - topMin) / 60) * hourHeight),
  }
}

export function eventLayout(startIso: string, endIso: string | null) {
  const startMin = minutesFromStart(startIso)
  const endMin = endIso ? minutesFromStart(endIso) : startMin + 30
  return layoutFromMinutes(startMin, endMin) ?? { top: 0, height: 18 }
}

export function clipToChicagoDay(start: Date, end: Date, day: Date) {
  const dayStart = startOfChicagoDay(day)
  const next = addDays(dayStart, 1)
  if (end.getTime() <= dayStart.getTime() || start.getTime() >= next.getTime()) {
    return null
  }
  const startsBefore = start.getTime() < dayStart.getTime()
  const endsAfter = end.getTime() >= next.getTime()
  const startMin = startsBefore ? 0 : chicagoMinutes(start)
  const endMin = endsAfter ? DAY_MINUTES : chicagoMinutes(end)
  return {
    startMin,
    endMin: Math.max(endMin, startMin + 15),
  }
}

export function allDayOnChicagoDay(event: { start: string; end: string | null; allDay: boolean }, day: Date) {
  if (!event.allDay) {
    return false
  }
  const startKey = dateKeyFromValue(event.start)
  const endKey = event.end ? dateKeyFromValue(event.end) : shiftYmd(startKey, 1)
  const dayKey = chicagoDateKey(day)
  const exclusiveEnd = endKey > startKey ? endKey : shiftYmd(startKey, 1)
  return dayKey >= startKey && dayKey < exclusiveEnd
}

export type PlacedEvent<T> = {
  item: T
  startMin: number
  endMin: number
  col: number
  colCount: number
}

export function placeTimedEvents<T>(
  items: Array<{ item: T; startMin: number; endMin: number }>,
): PlacedEvent<T>[] {
  const sorted = [...items].sort(
    (left, right) => left.startMin - right.startMin || right.endMin - left.endMin,
  )
  const columnEnds: number[] = []
  const placed = sorted.map((row) => {
    let col = columnEnds.findIndex((end) => end <= row.startMin)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(row.endMin)
    } else {
      columnEnds[col] = row.endMin
    }
    return { ...row, col, colCount: 1 }
  })
  return placed.map((event) => {
    const overlapping = placed.filter(
      (other) => other.startMin < event.endMin && other.endMin > event.startMin,
    )
    const colCount = Math.max(...overlapping.map((row) => row.col), event.col) + 1
    return { ...event, colCount }
  })
}

export function toDateInput(date: Date) {
  return chicagoDateKey(date)
}

export function parseDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfChicagoDay(new Date())
  }
  return chicagoWallToUtc(value, 0, 0, 0)
}
