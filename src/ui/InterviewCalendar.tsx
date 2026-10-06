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
  board?: number
  accentPersonId?: number | null
  onSelectDay?: (key: string) => void
}

export function InterviewCalendar({
  days,
  events,
  bidderByAccount,
  focusDay = 'all',
  board = 0,
  accentPersonId = null,
  onSelectDay,
}: InterviewCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [openId, setOpenId] = useState<string | null>(null)
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setSettled(new Set())
  }, [board])

  function settle(id: string, animationName: string) {
    if (animationName !== 'iv-snow') {
      return
    }
    setSettled((current) => {
      if (current.has(id)) {
        return current
      }
      const next = new Set(current)
      next.add(id)
      return next
    })
  }

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
  const namePeers = profilePeers(events, bidderByAccount)
  const cols = `52px repeat(${columns}, minmax(0, 1fr))`
  const scheduleKey = `${days.map((day) => chicagoDateKey(day)).join()}|${events.map((event) => event.id).join()}|${Math.round(hourHeight)}`

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current
      if (!node) {
        return
      }
      const placed = timedByDay.flat()
      const rangeStart = HOUR_START * 60
      const toTop = (minutes: number) => ((minutes - rangeStart) / 60) * hourHeight
      const pad = 16
      if (placed.length === 0) {
        node.scrollTop = showNow ? Math.max(0, nowTop - node.clientHeight * 0.3) : 0
        return
      }
      const startMin = Math.min(...placed.map((row) => row.startMin))
      const endMin = Math.max(...placed.map((row) => row.endMin))
      const top = Math.max(0, toTop(startMin))
      const bottom = toTop(endMin)
      const view = node.clientHeight
      if (bottom - top + pad * 2 <= view) {
        node.scrollTop = Math.max(0, top - pad)
        return
      }
      const nowInRange = showNow && nowTop >= top && nowTop <= bottom
      node.scrollTop = nowInRange
        ? Math.max(0, Math.min(top, nowTop - view * 0.28))
        : Math.max(0, top - pad)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [scheduleKey])

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
                    key={`${board}:${event.id}`}
                    type="button"
                    className={`iv-block iv-block-allday ${settled.has(event.id) ? 'is-settled' : ''} ${blockState(event, bidderByAccount, accentPersonId, openId)}`}
                    style={{
                      ...blockTone(owner?.color ?? event.color),
                      ...snowMotion(event.id, board, 72),
                    }}
                    title={`${event.title} · ${persona || event.email}`}
                    onAnimationEnd={(animation) => settle(event.id, animation.animationName)}
                    onClick={() => setOpenId(event.id)}
                  >
                    <span className="iv-block-copy">
                      <span className="iv-block-line">
                        {persona ? <b className="iv-block-owner">{profileFirst(persona, namePeers)}</b> : null}
                        {persona ? <i className="iv-block-dot" aria-hidden="true" /> : null}
                        <em>{event.title}</em>
                      </span>
                    </span>
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
                {timedByDay[dayIndex].map((placed) => {
                  const event = placed.item
                  const layout = layoutFromMinutes(placed.startMin, placed.endMin, hourHeight)
                  if (!layout) {
                    return null
                  }
                  const owner = bidderByAccount.get(event.accountId)
                  const persona = eventPersona(event, owner)
                  const profile = profileFirst(persona, namePeers)
                  const unit = 100 / placed.colCount
                  const narrow = placed.colCount > 1 && placed.span < placed.colCount
                  const compact = layout.height < 42
                  const time = formatEventTime(event.start, event.end)
                  const showTitle = !(narrow && compact)
                  return (
                    <button
                      key={`${board}:${event.id}:${placed.startMin}`}
                      type="button"
                      className={`iv-block ${compact ? 'is-compact' : ''} ${narrow ? 'is-narrow' : ''} ${settled.has(event.id) ? 'is-settled' : ''} ${blockState(event, bidderByAccount, accentPersonId, openId)}`}
                      style={{
                        ...blockTone(owner?.color ?? event.color),
                        top: layout.top,
                        height: layout.height,
                        left: `calc(${placed.col * unit}% + 3px)`,
                        width: `calc(${placed.span * unit}% - 6px)`,
                        zIndex: 2 + placed.col,
                        ...snowMotion(event.id, board, layout.top + 36),
                      }}
                      title={`${persona ? `${persona} · ` : ''}${event.title} · ${time}`}
                      onAnimationEnd={(animation) => settle(event.id, animation.animationName)}
                      onClick={(click) => {
                        click.stopPropagation()
                        setOpenId(event.id)
                      }}
                    >
                      <span className="iv-block-copy">
                        <span className="iv-block-line">
                          {profile ? <b className="iv-block-owner">{profile}</b> : null}
                          {profile && showTitle && !narrow ? <i className="iv-block-dot" aria-hidden="true" /> : null}
                          {showTitle ? <strong>{event.title}</strong> : null}
                        </span>
                        {compact ? null : <i className="iv-block-time">{time}</i>}
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

function snowMotion(id: string, board: number, fallPx: number) {
  let hash = board + 1
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 33 + id.charCodeAt(index)) >>> 0
  }
  const fall = Math.max(48, Math.round(fallPx))
  const bounce = Math.min(12, Math.max(4, Math.round(fall * 0.028)))
  return {
    animationDelay: `${hash % 700}ms`,
    animationDuration: `${640 + Math.round(Math.sqrt(fall) * 32)}ms`,
    '--snow-fall': `${fall}px`,
    '--snow-bounce': `${bounce}px`,
  } as CSSProperties
}

function eventPersona(event: CalendarEvent, owner: CalendarBidder | undefined) {
  return event.profileName?.trim() || owner?.name || ''
}

function profilePeers(events: CalendarEvent[], bidderByAccount: Map<number, CalendarBidder>) {
  const names = new Map<string, Set<string>>()
  for (const event of events) {
    const full = eventPersona(event, bidderByAccount.get(event.accountId))
    const first = full.split(/\s+/).find(Boolean)
    if (!first) {
      continue
    }
    const key = first.toLowerCase()
    const group = names.get(key) ?? new Set<string>()
    group.add(full)
    names.set(key, group)
  }
  const counts = new Map<string, number>()
  for (const [key, group] of names) {
    counts.set(key, group.size)
  }
  return counts
}

function profileFirst(name: string, peers: Map<string, number>) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return ''
  }
  const first = parts[0]
  if ((peers.get(first.toLowerCase()) ?? 0) > 1 && parts[1]) {
    return `${first} ${parts[1][0].toUpperCase()}.`
  }
  return first
}

function blockTone(color: string) {
  return { '--ev': color } as CSSProperties
}

export function InterviewCalendarSkeleton() {
  return <FunLoader label="Loading interviews" />
}
