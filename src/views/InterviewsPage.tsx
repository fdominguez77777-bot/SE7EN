import { useEffect, useMemo, useState, type CSSProperties } from 'react'
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

const PERSON_COLORS = [
  '#3d8bfd',
  '#14d6a5',
  '#f5b42a',
  '#ff4f8b',
  '#a06bff',
  '#22d3ee',
  '#ff7a3d',
  '#b6f04a',
  '#ff5d5d',
  '#60a5fa',
  '#e879f9',
  '#2ee6a6',
]

/** Hand out colors by position so no two people on the board share one. */
function withDistinctColors(people: CalendarBidder[]) {
  return [...people]
    .sort((a, b) => a.id - b.id)
    .map((person, index) => ({
      ...person,
      color: PERSON_COLORS[index % PERSON_COLORS.length],
    }))
}

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
  const [syncErrors, setSyncErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [board, setBoard] = useState(0)

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const from = weekStart.toISOString()
  const to = addDays(weekStart, 7).toISOString()

  async function load(quiet = false) {
    if (!quiet) {
      setLoading(true)
    }
    setError('')
    setSyncErrors([])
    try {
      const [{ data: bidderRows }, { data: eventPayload }] = await Promise.all([
        api.get<CalendarBidder[]>('/calendar/bidders'),
        api.get<CalendarEvent[] | { events: CalendarEvent[]; syncErrors?: string[] }>(
          '/calendar/events',
          { params: { from, to } },
        ),
      ])
      const eventRows = Array.isArray(eventPayload)
        ? eventPayload
        : Array.isArray(eventPayload?.events)
          ? eventPayload.events
          : []
      const nextSyncErrors = Array.isArray(eventPayload)
        ? []
        : eventPayload?.syncErrors ?? []
      setBidders(withDistinctColors(bidderRows))
      setSelected((current) => current.filter((id) => bidderRows.some((row) => row.id === id)))
      setEvents(eventRows)
      setSyncErrors(nextSyncErrors)
    } catch (err) {
      setError(getApiErrorMessage(err))
      setEvents([])
    } finally {
      setLoading(false)
      setBoard((current) => current + 1)
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
    const haystack = `${event.title} ${event.email} ${event.profileName ?? ''}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  const shownDays = focusDay === 'all' ? days : days.filter((day) => chicagoDateKey(day) === focusDay)

  return (
    <section className="apps-page iv-page">
      <div className="iv-toolbar">
        <div className="min-w-0">
          <p className="apps-crumb">Operations &gt; Interviews</p>
          <h1 className="mt-1 text-[26px] font-bold leading-none tracking-tight text-[var(--text-primary)]">
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
      {syncErrors.length > 0 ? (
        <div className="mt-2 rounded-lg border border-[rgba(215,169,93,0.22)] bg-[rgba(215,169,93,0.09)] px-4 py-3 text-sm text-[#ddb46e]">
          <p className="font-semibold text-[var(--text-primary)]">
            {syncErrors.length} calendar{syncErrors.length === 1 ? '' : 's'} need reconnecting
          </p>
          <p className="mt-1 text-[var(--text-secondary)]">
            These Google logins expired (common while the Cloud project is in Testing
            mode — about every 7 days). Disconnect each failed Gmail, then connect it
            again. Maani still works because that login has not expired yet.
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[12px] text-[var(--text-secondary)]">
            {syncErrors.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          {canConnectCalendars ? (
            <Link
              to="/interviews/integrations"
              className="mt-3 inline-flex text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Open Connect calendars →
            </Link>
          ) : null}
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
              style={{ '--person': bidder.color } as CSSProperties}
              onMouseEnter={() => setHovered(bidder.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(bidder.id)}
              onBlur={() => setHovered(null)}
              onClick={() => setSelected((current) => toggleSelected(current, bidder.id))}
            >
              <span className={`iv-check ${on ? 'is-on' : ''}`}>
                {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
              </span>
              <span className="iv-chip-swatch">{bidder.initials.slice(0, 2)}</span>
              <span className="iv-chip-copy">
                <span>{bidder.name}</span>
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
            board={board}
            accentPersonId={showAll ? hovered : selected.length === 1 ? selected[0] : hovered}
            onSelectDay={setFocusDay}
          />
        </div>
      )}
    </section>
  )
}
