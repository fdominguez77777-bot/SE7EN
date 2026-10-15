import type { CalendarEvent } from '../api/types'
import { chicagoWallToUtc } from './calendar-week'
import { findFreeSlots, formatSlot, freeSlotsMessage } from './free-slots'

function event(start: string, end: string | null, allDay = false) {
  return { id: start, start, end, allDay } as CalendarEvent
}

// Sunday, Jan 11 2026 (CST)
const weekStart = chicagoWallToUtc('2026-01-11')
const before = new Date('2026-01-01T00:00:00Z')

describe('findFreeSlots', () => {
  it('returns the full 9–5 window on each weekday when nothing is booked', () => {
    const days = findFreeSlots([], weekStart, { now: before })
    expect(days).toHaveLength(5)
    expect(days.map((row) => row.slots.map(formatSlot))).toEqual(
      Array(5).fill(['9:00 AM – 5:00 PM']),
    )
  })

  it('subtracts overlapping meetings and drops gaps shorter than the minimum', () => {
    const days = findFreeSlots(
      [
        event('2026-01-12T10:00:00-06:00', '2026-01-12T11:00:00-06:00'),
        event('2026-01-12T10:30:00-06:00', '2026-01-12T12:00:00-06:00'),
        event('2026-01-12T12:20:00-06:00', '2026-01-12T16:00:00-06:00'),
        event('2026-01-12T08:00:00-06:00', '2026-01-12T09:30:00-06:00'),
        event('2026-01-13T00:00:00-06:00', null, true),
      ],
      weekStart,
      { now: before },
    )
    expect(days[0].slots.map(formatSlot)).toEqual(['9:30 AM – 10:00 AM', '4:00 PM – 5:00 PM'])
    expect(days[1].slots.map(formatSlot)).toEqual(['9:00 AM – 5:00 PM'])

    const longer = findFreeSlots(
      [event('2026-01-12T09:30:00-06:00', '2026-01-12T16:30:00-06:00')],
      weekStart,
      { now: before, minMinutes: 60 },
    )
    expect(longer[0].slots).toEqual([])
  })

  it('skips time that has already passed, rounded up to the next quarter hour', () => {
    const days = findFreeSlots([], weekStart, { now: new Date('2026-01-14T19:07:00Z') })
    expect(days[0].slots).toEqual([])
    expect(days[1].slots).toEqual([])
    expect(days[2].slots.map(formatSlot)).toEqual(['1:15 PM – 5:00 PM'])
  })

  it('covers the following week when asked for two weeks', () => {
    const days = findFreeSlots(
      [event('2026-01-20T09:00:00-06:00', '2026-01-20T12:00:00-06:00')],
      weekStart,
      { now: before, weeks: 2 },
    )
    expect(days).toHaveLength(10)
    expect(days[5].day.toISOString()).toBe(chicagoWallToUtc('2026-01-19').toISOString())
    expect(days[6].slots.map(formatSlot)).toEqual(['12:00 PM – 5:00 PM'])
    expect(days[9].day.toISOString()).toBe(chicagoWallToUtc('2026-01-23').toISOString())
  })

  it('builds a pasteable reply', () => {
    const days = findFreeSlots(
      [event('2026-01-12T09:00:00-06:00', '2026-01-12T17:00:00-06:00')],
      weekStart,
      { now: before },
    )
    const message = freeSlotsMessage(days)
    expect(message).toContain("Here are the times I'm available (CST):")
    expect(message).not.toContain('Mon, Jan 12')
    expect(message).toContain(
      [
        '• Tue, Jan 13: 9:00 AM – 5:00 PM',
        '• Wed, Jan 14: 9:00 AM – 5:00 PM',
        '• Thu, Jan 15: 9:00 AM – 5:00 PM',
        '• Fri, Jan 16: 9:00 AM – 5:00 PM',
      ].join('\n'),
    )
  })
})
