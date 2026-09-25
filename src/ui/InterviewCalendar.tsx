import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { CalendarBidder, CalendarEvent } from '../api/types'
import { InterviewEventDetails } from './InterviewEventDetails'
import { FunLoader } from './loading/fun-loader'
import {
  CALENDAR_HOURS,
  HOUR_END,
  HOUR_HEIGHT,
  HOUR_START,
  INTERVIEW_TIME_ZONE,
  MIN_HOUR_HEIGHT,
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

/** Vertical padding (top + bottom) inside the scroll area, kept in sync with `.iv-cal-scroll`. */
const GRID_INSET = 18

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
      const next = (node.clientHeight - GRID_INSET) / CALENDAR_HOURS.length
      setHourHeight(
        Number.isFinite(next) && next > MIN_HOUR_HEIGHT ? next : MIN_HOUR_HEIGHT,
      )
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
  const todayKey = chicagoDateKey(today)
  const zone = chicagoTimeZoneName(today)
  const columns = days.length
  const nowMinutes = chicagoMinutes(today)
  const showNow =
    days.some((day) => sameDay(day, today)) &&
    nowMinutes >= HOUR_START * 60 &&
    nowMinutes < HOUR_END * 60
  const nowTop = ((nowMinutes - HOUR_START * 60) / 60) * hourHeight
  const pastHeight = Math.min(
    CALENDAR_HOURS.length * hourHeight,
    Math.max(0, nowTop),
  )
  const nowLabel = today.toLocaleTimeString('en-US', {
    timeZone: INTERVIEW_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  })
  const allDayByDay = days.map((day) => events.filter((event) => allDayOnChicagoDay(event, day)))
  const hasAllDay = allDayByDay.some((rows) => rows.length > 0)
  const timedByDay = days.map((day) =>
    placeTimedEvents(
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
    ),
  )
  const cols = `52px repeat(${columns}, minmax(0, 1fr))`

  function ownerColors(dayIndex: number) {
    const colors = new Set<string>()
    for (const event of [...allDayByDay[dayIndex], ...timedByDay[dayIndex].map((row) => row.item)]) {
      colors.add(bidderByAccount.get(event.accountId)?.color ?? event.color)
    }
    return [...colors]
  }

  return (
    <div className="iv-cal">
      <div className="iv-cal-head" style={{ gridTemplateColumns: cols }}>
        <div className="iv-cal-tz">
          <span>{zone}</span>
        </div>
        {days.map((day, index) => {
          const head = formatDayHead(day)
          const key = chicagoDateKey(day)
          const count = allDayByDay[index].length + timedByDay[index].length
          const dots = ownerColors(index)
          const dayNumber = day.toLocaleString('en-US', {
            timeZone: INTERVIEW_TIME_ZONE,
            day: 'numeric',
          })
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={[
                'iv-cal-dayhead',
                key === todayKey ? 'is-today' : '',
                key < todayKey ? 'is-past' : '',
                focusDay === key ? 'is-on' : '',
              ].join(' ')}
              aria-pressed={focusDay === key}
              title={focusDay === key ? 'Show full week' : `Show ${head.weekday} ${head.monthDay}`}
              onClick={() => onSelectDay?.(focusDay === key ? 'all' : key)}
            >
              <span className="iv-dh-week">{head.weekday}</span>
              <strong className="iv-dh-num">{dayNumber}</strong>
              <span className="iv-dh-meta">
                {count > 0 ? (
                  <>
                    <span className="iv-dh-dots" aria-hidden="true">
                      {dots.slice(0, 4).map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                    {count}
                  </>
                ) : (
                  'Free'
                )}
              </span>
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
                const persona = eventPersona(event, owner)
                return (
                  <button
                    key={event.id}
                    type="button"
                    className={`iv-block iv-block-allday ${blockState(event, bidderByAccount, accentPersonId, openId)}`}
                    style={blockTone(owner?.color ?? event.color)}
                    title={`${event.title} · ${persona || event.email}`}
                    onClick={() => setOpenId(event.id)}
                  >
                    {persona ? <i className="iv-avatar">{personaInitials(persona)}</i> : null}
                    <em>{event.title}</em>
                    {persona ? <b className="iv-block-owner">{persona}</b> : null}
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
          style={
            {
              gridTemplateColumns: cols,
              height: CALENDAR_HOURS.length * hourHeight,
              '--hour': `${hourHeight}px`,
            } as CSSProperties
          }
        >
          <div className="iv-cal-hours">
            {CALENDAR_HOURS.map((hour) => (
              <div key={hour} className="iv-cal-hour" style={{ height: hourHeight }}>
                <span>{formatHour(hour)}</span>
              </div>
            ))}
            {showNow ? (
              <div className="iv-now-pill" style={{ top: nowTop }}>
                {nowLabel}
              </div>
            ) : null}
          </div>
          {days.map((day, dayIndex) => {
            const key = chicagoDateKey(day)
            const isToday = key === todayKey
            return (
              <div
                key={day.toISOString()}
                className={[
                  'iv-cal-col',
                  isToday ? 'is-today' : '',
                  key < todayKey ? 'is-past' : '',
                  focusDay === key ? 'is-on' : '',
                ].join(' ')}
                onClick={() => onSelectDay?.(focusDay === key ? 'all' : key)}
              >
                {isToday && pastHeight > 0 ? (
                  <div className="iv-past" style={{ height: pastHeight }} />
                ) : null}
                {showNow && isToday ? (
                  <div className="iv-now" style={{ top: nowTop }}>
                    <i />
                  </div>
                ) : null}
                {timedByDay[dayIndex].map((placed, index) => {
                  const event = placed.item
                  const layout = layoutFromMinutes(placed.startMin, placed.endMin, hourHeight)
                  if (!layout) {
                    return null
                  }
                  const owner = bidderByAccount.get(event.accountId)
                  const persona = eventPersona(event, owner)
                  const unit = 100 / placed.colCount
                  const compact = layout.height < 44
                  const done = key < todayKey || (isToday && placed.endMin <= nowMinutes)
                  const time = formatEventTime(event.start, event.end)
                  return (
                    <button
                      key={`${event.id}:${placed.startMin}`}
                      type="button"
                      className={[
                        'iv-block',
                        compact ? 'is-compact' : '',
                        done ? 'is-done' : '',
                        blockState(event, bidderByAccount, accentPersonId, openId),
                      ].join(' ')}
                      style={{
                        ...blockTone(owner?.color ?? event.color),
                        top: layout.top + 1,
                        height: layout.height - 2,
                        left: `calc(${placed.col * unit}% + 4px)`,
                        width: `calc(${placed.span * unit}% - 8px)`,
                        zIndex: 2 + placed.col,
                        animationDelay: `${Math.min(index, 8) * 40 + dayIndex * 25}ms`,
                      }}
                      title={`${event.title} · ${time}${persona ? ` · ${persona}` : ''}`}
                      onClick={(click) => {
                        click.stopPropagation()
                        setOpenId(event.id)
                      }}
                    >
                      <span className="iv-block-time">{time}</span>
                      <strong>{event.title}</strong>
                      {persona ? (
                        <span className="iv-block-who">
                          <i className="iv-avatar">{personaInitials(persona)}</i>
                          <b className="iv-block-owner">{persona}</b>
                        </span>
                      ) : null}
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

function eventPersona(event: CalendarEvent, owner: CalendarBidder | undefined) {
  return event.profileName?.trim() || owner?.name || ''
}

function personaInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()
}

function blockTone(color: string) {
  return { '--ev': color } as CSSProperties
}

export function InterviewCalendarSkeleton() {
  return <FunLoader label="Loading interviews" />
}
