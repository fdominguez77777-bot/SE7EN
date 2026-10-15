import type { CalendarEvent } from '../api/types'
import {
  INTERVIEW_TIME_ZONE,
  addDays,
  chicagoDateKey,
  chicagoTimeZoneName,
  chicagoWallToUtc,
  parseCalendarInstant,
  weekDays,
} from './calendar-week'

export const WORK_HOUR_START = 9
export const WORK_HOUR_END = 17

const SLOT_STEP_MS = 15 * 60_000
const DEFAULT_EVENT_MS = 30 * 60_000

export type FreeSlot = { start: Date; end: Date }

export type FreeDay = { day: Date; slots: FreeSlot[] }

type Interval = { start: number; end: number }

function busyIntervals(events: CalendarEvent[]): Interval[] {
  const rows: Interval[] = []
  for (const event of events) {
    if (event.allDay) {
      continue
    }
    const start = parseCalendarInstant(event.start).getTime()
    const parsedEnd = event.end ? parseCalendarInstant(event.end).getTime() : Number.NaN
    const end = Number.isFinite(parsedEnd) && parsedEnd > start ? parsedEnd : start + DEFAULT_EVENT_MS
    if (Number.isFinite(start)) {
      rows.push({ start, end })
    }
  }
  rows.sort((left, right) => left.start - right.start)
  const merged: Interval[] = []
  for (const row of rows) {
    const last = merged[merged.length - 1]
    if (last && row.start <= last.end) {
      last.end = Math.max(last.end, row.end)
    } else {
      merged.push({ ...row })
    }
  }
  return merged
}

/** Open windows Monday–Friday, 9 AM–5 PM Chicago time, for `weeks` weeks starting on `weekStart` (Sunday). */
export function findFreeSlots(
  events: CalendarEvent[],
  weekStart: Date,
  {
    minMinutes = 30,
    now = new Date(),
    weeks = 1,
  }: { minMinutes?: number; now?: Date; weeks?: number } = {},
): FreeDay[] {
  const busy = busyIntervals(events)
  const minMs = minMinutes * 60_000
  const earliest = Math.ceil(now.getTime() / SLOT_STEP_MS) * SLOT_STEP_MS

  return Array.from({ length: weeks }, (_, week) => weekDays(addDays(weekStart, week * 7)).slice(1, 6))
    .flat()
    .map((day) => {
      const ymd = chicagoDateKey(day)
      const dayEnd = chicagoWallToUtc(ymd, WORK_HOUR_END).getTime()
      let cursor = Math.max(chicagoWallToUtc(ymd, WORK_HOUR_START).getTime(), earliest)
      const slots: FreeSlot[] = []
      for (const block of busy) {
        if (cursor >= dayEnd) {
          break
        }
        if (block.end <= cursor) {
          continue
        }
        const gapEnd = Math.min(block.start, dayEnd)
        if (gapEnd - cursor >= minMs) {
          slots.push({ start: new Date(cursor), end: new Date(gapEnd) })
        }
        cursor = Math.max(cursor, block.end)
      }
      if (dayEnd - cursor >= minMs) {
        slots.push({ start: new Date(cursor), end: new Date(dayEnd) })
      }
      return { day, slots }
    })
}

const timeOpts: Intl.DateTimeFormatOptions = {
  timeZone: INTERVIEW_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
}

export function formatSlot(slot: FreeSlot) {
  return `${slot.start.toLocaleTimeString('en-US', timeOpts)} – ${slot.end.toLocaleTimeString('en-US', timeOpts)}`
}

export function formatFreeDay(day: Date) {
  return day.toLocaleDateString('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Plain-text list ready to paste into a scheduling reply. */
export function freeSlotsMessage(days: FreeDay[]) {
  const open = days.filter((row) => row.slots.length > 0)
  if (open.length === 0) {
    return ''
  }
  const zone = chicagoTimeZoneName(open[0].day)
  const lines = open.map(
    (row) => `• ${formatFreeDay(row.day)}: ${row.slots.map(formatSlot).join(', ')}`,
  )
  return [
    `Thank you for reaching out! Here are the times I'm available (${zone}):`,
    '',
    ...lines,
    '',
    'Please feel free to pick whichever works best for you. Looking forward to speaking with you!',
  ].join('\n')
}
