import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'
import { Check, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { CalendarBidder, CalendarEvent } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { InterviewCalendar, InterviewCalendarSkeleton } from '../ui/InterviewCalendar'
import {
  addDays,
  chicagoDateKey,
  formatWeekLabel,
  startOfWeek,
  weekDays,
} from '../ui/calendar-week'

const SELECTED_KEY = 'bp_interview_bidder'

function loadSelected(): number[] {
  try {
    const raw = localStorage.getItem(SELECTED_KEY)
    if (!raw || raw === 'all') {
      return []
    }
    if (raw.startsWith('[')) {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed.map(Number).filter((id) => Number.isFinite(id))
    }
    const id = Number(raw)
    return Number.isFinite(id) ? [id] : []
  } catch {
    return []
  }
}

function toggleSelected(current: number[], id: number) {
  if (current.length === 0) {
    return [id]
  }
  if (current.includes(id)) {
    return current.filter((row) => row !== id)
  }
  return [...current, id]
}

function personChipHint(person: CalendarBidder, meId: number | undefined) {
  const count = person.calendarEmails?.length ?? (person.calendarEmail ? 1 : 0)
  const role =
    person.id === meId
      ? 'You'
      : person.role === 'ADMIN'
        ? 'Admin'
        : person.role === 'BID_MANAGER'
          ? 'Bid manager'
          : 'Bidder'
  if (count === 0) {
    return `${role} · Not connected`
  }
  if (count === 1) {
    return `${role} · 1 calendar`
  }
  return `${role} · ${count} calendars`
}

export function InterviewsPage() {
  const { user } = useAuth()
  const canConnectCalendars = user?.role === 'ADMIN'
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [bidders, setBidders] = useState<CalendarBidder[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selected, setSelected] = useState<number[]>(loadSelected)
  const [hovered, setHovered] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [focusDay, setFocusDay] = useState<string>('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const from = weekStart.toISOString()
  const to = addDays(weekStart, 7).toISOString()

  async function load(quiet = false) {
    if (!quiet) {
      setLoading(true)
    }
    setError('')
    try {
      const { data: bidderRows } = await api.get<CalendarBidder[]>('/calendar/bidders')
      setBidders(bidderRows)
      setSelected((current) => current.filter((id) => bidderRows.some((row) => row.id === id)))
      const { data: eventRows } = await api.get<CalendarEvent[]>('/calendar/events', {
        params: { from, to },
      })
      setEvents(eventRows)
    } catch (err) {
      setError(getApiErrorMessage(err))
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [from, to])

  useEffect(() => {
    setFocusDay('all')
  }, [from])

  useEffect(() => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(selected))
  }, [selected])

  const bidderByAccount = useMemo(() => {
    const map = new Map<number, CalendarBidder>()
    for (const person of bidders) {
      const ids = person.accountIds?.length
        ? person.accountIds
        : person.accountId
          ? [person.accountId]
          : []
      for (const accountId of ids) {
        map.set(accountId, person)
      }
    }
    return map
  }, [bidders])

  const showAll = selected.length === 0
  const selectedPeople = bidders.filter((row) => selected.includes(row.id))
  const visibleEvents = events.filter((event) => {
    if (!showAll) {
      const owner = bidderByAccount.get(event.accountId)
      const ownerId = owner?.id ?? event.bidderId
      if (!ownerId || !selected.includes(ownerId)) {
        return false
      }
    }
    const haystack = `${event.title} ${event.email}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  const shownDays = focusDay === 'all' ? days : days.filter((day) => chicagoDateKey(day) === focusDay)

  return (
    <section className="apps-page iv-page">
      <div className="iv-toolbar">
        <div className="min-w-0">
          <p className="apps-crumb">Operations &gt; Interviews</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
            Interviews
          </h1>
          <p className="apps-count">
            {visibleEvents.length.toLocaleString()} this week
            {selectedPeople.length === 1
              ? ` · ${selectedPeople[0].name}`
              : selectedPeople.length > 1
                ? ` · ${selectedPeople.length} people`
                : ''}
            {' · 7 AM – 7 PM CT'}
          </p>
        </div>
        <div className="iv-toolbar-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setWeekStart(startOfWeek(new Date()))
              setFocusDay('all')
            }}
          >
            This week
          </Button>
          <Button variant="secondary" onClick={() => void load(true)}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {canConnectCalendars ? (
            <Link to="/interviews/integrations" className="text-[13px] font-semibold text-[var(--accent)]">
              Connect calendars
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="iv-weekbar glass-toolbar mt-3">
        <button
          type="button"
          className="apps-page-btn"
          aria-label="Previous week"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          <ChevronLeft className="mx-auto h-4 w-4" />
        </button>
        <p className="iv-week-label">{formatWeekLabel(weekStart)}</p>
        <button
          type="button"
          className="apps-page-btn"
          aria-label="Next week"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          <ChevronRight className="mx-auto h-4 w-4" />
        </button>
        <label className="filter-search input-with-icon iv-week-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            className="input-field mt-0"
            placeholder="Search titles"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="iv-people">
        <button
          type="button"
          className={`iv-chip ${showAll ? 'is-on' : ''}`}
          aria-pressed={showAll}
          onClick={() => setSelected([])}
        >
          <span className={`iv-check ${showAll ? 'is-on' : ''}`}>
            {showAll ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
          </span>
          Everyone
        </button>
        {bidders.map((bidder) => {
          const on = showAll || selected.includes(bidder.id)
          return (
            <button
              key={bidder.id}
              type="button"
              className={`iv-chip ${on ? 'is-on' : ''} ${hovered === bidder.id && !on ? 'is-peek' : ''}`}
              aria-pressed={on}
              title={
                showAll
                  ? `Show only ${bidder.name}`
                  : on
                    ? `Hide ${bidder.name}`
                    : `Show ${bidder.name}`
              }
              style={{
                borderColor: bidder.color,
                background: on
                  ? `color-mix(in srgb, ${bidder.color} 28%, #15171b)`
                  : `color-mix(in srgb, ${bidder.color} 12%, #15171b)`,
              }}
              onMouseEnter={() => setHovered(bidder.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(bidder.id)}
              onBlur={() => setHovered(null)}
              onClick={() => setSelected((current) => toggleSelected(current, bidder.id))}
            >
              <span
                className={`iv-check ${on ? 'is-on' : ''}`}
                style={on ? { background: bidder.color, borderColor: bidder.color } : { borderColor: bidder.color }}
              >
                {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="iv-chip-swatch" style={{ background: bidder.color }}>
                {bidder.initials.slice(0, 2)}
              </span>
              <span className="iv-chip-copy">
                <span style={{ color: bidder.color }}>{bidder.name}</span>
                <small>{personChipHint(bidder, user?.id)}</small>
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="iv-cal-wrap">
          <InterviewCalendarSkeleton />
        </div>
      ) : bidders.length === 0 ? (
        <div className="iv-cal-wrap">
          <EmptyState
            title="No bidders yet"
            description="Interviews show up here after calendars are connected to bidders."
            action={
              canConnectCalendars ? (
                <Link to="/interviews/integrations" className="text-[13px] font-semibold text-[var(--accent)]">
                  Connect calendars
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="iv-cal-wrap">
          <InterviewCalendar
            days={shownDays}
            events={visibleEvents}
            bidderByAccount={bidderByAccount}
            focusDay={focusDay}
            accentPersonId={showAll ? hovered : selected.length === 1 ? selected[0] : hovered}
            onSelectDay={setFocusDay}
          />
        </div>
      )}
    </section>
  )
}
