import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, X } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { CalendarEvent } from '../api/types'
import { addDays, chicagoTimeZoneName } from './calendar-week'
import { Alert, Button } from './chrome'
import { findFreeSlots, formatFreeDay, formatSlot, freeSlotsMessage } from './free-slots'

const DURATIONS = [30, 45, 60]
const MAX_WEEKS = 2

export function FreeSlotsDialog({
  weekStart,
  scopeLabel,
  includeEvent,
  onClose,
}: {
  weekStart: Date
  scopeLabel: string
  includeEvent: (event: CalendarEvent) => boolean
  onClose: () => void
}) {
  const [minMinutes, setMinMinutes] = useState(30)
  const [includeNextWeek, setIncludeNextWeek] = useState(false)
  const [copiedText, setCopiedText] = useState('')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api
      .get<CalendarEvent[] | { events: CalendarEvent[] }>('/calendar/events', {
        params: {
          from: weekStart.toISOString(),
          to: addDays(weekStart, MAX_WEEKS * 7).toISOString(),
        },
      })
      .then(({ data }) => {
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data : (data?.events ?? []))
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  const relevant = events.filter(includeEvent)
  const weekCount = includeNextWeek ? MAX_WEEKS : 1
  const days = findFreeSlots(relevant, weekStart, { minMinutes, weeks: weekCount })
  const weeks = Array.from({ length: weekCount }, (_, index) => days.slice(index * 5, index * 5 + 5))
  const ready = !loading && !error
  const message = ready ? freeSlotsMessage(days) : ''
  const copied = Boolean(message) && copiedText === message
  const zone = chicagoTimeZoneName(weekStart)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopiedText(message)
    } catch {
      setCopiedText('')
    }
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="apps-modal iv-detail-overlay" onClick={onClose} role="presentation">
      <div
        className="apps-modal-panel iv-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iv-free-title"
        onClick={(click) => click.stopPropagation()}
      >
        <div className="iv-detail-accent" />
        <div className="apps-modal-head">
          <div className="min-w-0">
            <p className="iv-detail-kicker">
              {formatFreeDay(addDays(weekStart, 1))} – {formatFreeDay(addDays(weekStart, weekCount * 7 - 2))}
            </p>
            <h2 id="iv-free-title" className="iv-detail-title">
              Available times
            </h2>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Mon – Fri · 9 AM – 5 PM {zone} · {scopeLabel}
            </p>
          </div>
          <div className="apps-modal-actions">
            <button type="button" className="apps-icon-btn" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="iv-detail-body overflow-x-hidden">
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <span className="whitespace-nowrap">Minimum length</span>
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              {DURATIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={minMinutes === minutes}
                  onClick={() => setMinMinutes(minutes)}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
                    minMinutes === minutes
                      ? 'bg-[var(--accent)] text-[#111214]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[var(--text-secondary)]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--accent)]"
                checked={includeNextWeek}
                onChange={(event) => setIncludeNextWeek(event.target.checked)}
              />
              Include next week
            </label>
          </div>
          {error ? <Alert>{error}</Alert> : null}
          {loading ? (
            <p className="px-1 py-4 text-[13px] text-[var(--text-muted)]">Loading calendars…</p>
          ) : null}
          {ready
            ? weeks.map((rows) => (
                <div key={rows[0].day.toISOString()}>
                  {weekCount > 1 ? (
                    <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      Week of {formatFreeDay(rows[0].day).split(', ')[1]}
                    </p>
                  ) : null}
                  <div className="divide-y divide-white/[0.06] rounded-[14px] border border-white/[0.06] bg-white/[0.03]">
                    {rows.map((row) => (
                      <div
                        key={row.day.toISOString()}
                        className={`grid grid-cols-[92px_minmax(0,1fr)] items-start gap-2 px-3 py-1.5 ${
                          row.slots.length === 0 ? 'opacity-50' : ''
                        }`}
                      >
                        <span className="pt-0.5 text-[12px] font-semibold text-[var(--text-primary)]">
                          {formatFreeDay(row.day)}
                        </span>
                        {row.slots.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.slots.map((slot) => (
                              <span
                                key={slot.start.toISOString()}
                                className="whitespace-nowrap rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-[var(--text-secondary)]"
                              >
                                {formatSlot(slot)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="pt-0.5 text-[12px] text-[var(--text-muted)]">No openings</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : null}
        </div>
        <div className="iv-detail-foot">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void copy()} disabled={!message}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy reply'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
