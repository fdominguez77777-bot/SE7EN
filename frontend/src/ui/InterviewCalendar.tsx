import { useEffect, useRef, useState } from 'react'

import type { CalendarBidder, CalendarEvent } from '../api/types'
import { InterviewEventDetails } from './InterviewEventDetails'
import {
  CALENDAR_HOURS,
  HOUR_END,
  HOUR_HEIGHT,
  HOUR_START,
  allDayOnChicagoDay,
  chicagoDateKey,
  chicagoMinutes,
  chicagoTimeZoneName,
  clipToChicagoDay,
  formatDayHead,
  formatEventTime,
  formatHour,
  layoutFromMinutes,
  parseCalendarInstant,
  placeTimedEvents,
  sameDay,
} from './calendar-week'

type InterviewCalendarProps = {
  days: Date[]
  events: CalendarEvent[]
  bidderByAccount: Map<number, CalendarBidder>
  focusDay?: string
  accentPersonId?: number | null
  onSelectDay?: (key: string) => void
}

export function InterviewCalendar({
  days,
  events,
  bidderByAccount,
  focusDay = 'all',
  accentPersonId = null,
  onSelectDay,
}: InterviewCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [openId, setOpenId] = useState<string | null>(null)
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) {
      return
    }
    const fit = () => {
      const next = node.clientHeight / CALENDAR_HOURS.length
      setHourHeight(Number.isFinite(next) && next > 0 ? next : HOUR_HEIGHT)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(node)
    return () => observer.disconnect()
  }, [days.length])

  useEffect(() => {
    if (openId && !events.some((row) => row.id === openId)) {
      setOpenId(null)
    }
  }, [events, openId])

  const openEvent = events.find((row) => row.id === openId) ?? null
  const today = now
  const zone = chicagoTimeZoneName(today)
  const columns = days.length
  const nowMinutes = chicagoMinutes(today)
  const showNow =
    days.some((day) => sameDay(day, today)) &&
    nowMinutes >= HOUR_START * 60 &&
    nowMinutes < HOUR_END * 60
  const nowTop = ((nowMinutes - HOUR_START * 60) / 60) * hourHeight
  const allDayByDay = days.map((day) => events.filter((event) => allDayOnChicagoDay(event, day)))
  const hasAllDay = allDayByDay.some((rows) => rows.length > 0)
  const cols = `56px repeat(${columns}, minmax(0, 1fr))`

  return (
    <div className="iv-cal">
      <div className="iv-cal-head" style={{ gridTemplateColumns: cols }}>
        <div className="iv-cal-gutter iv-cal-tz">{zone}</div>
        {days.map((day) => {
          const head = formatDayHead(day)
          const key = chicagoDateKey(day)
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`iv-cal-dayhead ${sameDay(day, today) ? 'is-today' : ''} ${focusDay === key ? 'is-on' : ''}`}
              aria-pressed={focusDay === key}
              title={focusDay === key ? 'Show full week' : `Show ${head.weekday}`}
              onClick={() => onSelectDay?.(focusDay === key ? 'all' : key)}
            >
              <span>{head.weekday}</span>
              <strong>{head.monthDay}</strong>
            </button>
          )
        })}
      </div>
      {hasAllDay ? (
        <div className="iv-cal-allday" style={{ gridTemplateColumns: cols }}>
          <div className="iv-cal-gutter">
            <span>All day</span>
          </div>
          {days.map((day, index) => (
            <div key={day.toISOString()} className="iv-cal-allday-col">
              {allDayByDay[index].map((event) => {
                const owner = bidderByAccount.get(event.accountId)
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`iv-block iv-block-allday ${blockState(event, bidderByAccount, accentPersonId, openId)}`}
                    style={blockTone(event.color)}
                    title={`${event.title} · ${owner?.name || event.email}`}
                    onClick={() => setOpenId(event.id)}
                  >
                    <em>{event.title}</em>
                    <span>{owner?.name || event.email}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
      <div className="iv-cal-scroll" ref={scrollRef}>
        <div
          className="iv-cal-grid"
          style={{
            gridTemplateColumns: cols,
            height: CALENDAR_HOURS.length * hourHeight,
          }}
        >
          <div className="iv-cal-hours">
            {CALENDAR_HOURS.map((hour) => (
              <div key={hour} className="iv-cal-hour" style={{ height: hourHeight }}>
                <span>{formatHour(hour)}</span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const timed = placeTimedEvents(
              events.flatMap((event) => {
                if (event.allDay) {
                  return []
                }
                const start = parseCalendarInstant(event.start)
                const end = event.end
                  ? parseCalendarInstant(event.end)
                  : new Date(start.getTime() + 30 * 60_000)
                const clip = clipToChicagoDay(start, end, day)
                if (!clip) {
                  return []
                }
                return [{ item: event, ...clip }]
              }),
            )
            return (
              <div
                key={day.toISOString()}
                className={`iv-cal-col ${sameDay(day, today) ? 'is-today' : ''} ${focusDay === chicagoDateKey(day) ? 'is-on' : ''}`}
                onClick={() => {
                  const key = chicagoDateKey(day)
                  onSelectDay?.(focusDay === key ? 'all' : key)
                }}
              >
                {CALENDAR_HOURS.map((hour) => (
                  <div key={hour} className="iv-cal-slot" style={{ height: hourHeight }} />
                ))}
                {showNow && sameDay(day, today) ? (
                  <div className="iv-now" style={{ top: nowTop }}>
                    <i />
                  </div>
                ) : null}
                {timed.map((placed) => {
                  const event = placed.item
                  const layout = layoutFromMinutes(placed.startMin, placed.endMin, hourHeight)
                  if (!layout) {
                    return null
                  }
                  const owner = bidderByAccount.get(event.accountId)
                  const width = 100 / placed.colCount
                  return (
                    <button
                      key={`${event.id}:${placed.startMin}`}
                      type="button"
                      className={`iv-block ${blockState(event, bidderByAccount, accentPersonId, openId)}`}
                      style={{
                        ...blockTone(event.color),
                        top: layout.top,
                        height: layout.height,
                        left: `calc(${placed.col * width}% + 3px)`,
                        width: `calc(${width}% - 6px)`,
                      }}
                      title={`${event.title} · ${formatEventTime(event.start, event.end)}${owner ? ` · ${owner.name}` : ''}`}
                      onClick={(click) => {
                        click.stopPropagation()
                        setOpenId(event.id)
                      }}
                    >
                      <strong>{event.title}</strong>
                      <span>
                        {formatEventTime(event.start, event.end)}
                        {owner ? ` · ${owner.name}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      {openEvent ? (
        <InterviewEventDetails
          key={openEvent.id}
          event={openEvent}
          owner={bidderByAccount.get(openEvent.accountId) ?? null}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  )
}

function blockState(
  event: CalendarEvent,
  bidderByAccount: Map<number, CalendarBidder>,
  accentPersonId: number | null,
  openId: string | null,
) {
  if (openId === event.id) {
    return 'is-open'
  }
  if (accentPersonId == null) {
    return ''
  }
  const ownerId = bidderByAccount.get(event.accountId)?.id ?? event.bidderId
  return ownerId === accentPersonId ? 'is-hot' : 'is-dim'
}

function blockTone(color: string): { background: string; borderColor: string; color: string } {
  return {
    background: `color-mix(in srgb, ${color} 32%, #15171b)`,
    borderColor: color,
    color: '#f4f5f7',
  }
}

export function InterviewCalendarSkeleton() {
  return (
    <div className="iv-cal iv-cal-skel">
      <div className="iv-cal-head" style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}>
        <div />
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="iv-cal-dayhead">
            <span>DAY</span>
            <strong>—</strong>
          </div>
        ))}
      </div>
      <div className="iv-cal-scroll" />
    </div>
  )
}
