import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Clock, ExternalLink, MapPin, Users, Video, X } from 'lucide-react'

import type { CalendarBidder, CalendarEvent, CalendarGuest } from '../api/types'
import { EntityAvatar } from './avatar'
import { formatEventWhen } from './calendar-week'
import { Button } from './chrome'
import { safeHttpUrl } from './job-application'

const RSVP: Record<CalendarGuest['status'], string> = {
  accepted: 'Yes',
  declined: 'No',
  tentative: 'Maybe',
  needsAction: 'Awaiting',
}

export function InterviewEventDetails({
  event,
  owner,
  onClose,
}: {
  event: CalendarEvent
  owner: CalendarBidder | null
  onClose: () => void
}) {
  const when = formatEventWhen(event.start, event.end, event.allDay)
  const joinUrl = safeHttpUrl(event.joinUrl)
  const calendarUrl = safeHttpUrl(event.htmlLink)
  const guests = event.guests ?? []
  const description = plainText(event.description)
  const calendarLabel = owner?.name || event.email
  const calendarEmail = owner?.calendarEmail || event.email

  const [leaving, setLeaving] = useState(false)

  function close() {
    if (leaving) {
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    setLeaving(true)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [leaving])

  return (
    <div
      className={`apps-modal iv-detail-overlay ${leaving ? 'is-out' : ''}`}
      onClick={close}
      role="presentation"
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="apps-modal-panel iv-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="iv-detail-title"
        onClick={(click) => click.stopPropagation()}
      >
        <div className="iv-detail-accent" style={{ background: event.color }} />
        <div className="apps-modal-head">
          <div className="min-w-0">
            <h2 id="iv-detail-title" className="text-[22px] font-bold text-[var(--text-primary)]">
              {event.title}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{when.dateLabel}</p>
          </div>
          <div className="apps-modal-actions">
            <button type="button" className="apps-icon-btn" aria-label="Close" onClick={close}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="iv-detail-body">
          {joinUrl ? (
            <a className="iv-detail-join" href={joinUrl} target="_blank" rel="noreferrer">
              <Video className="h-4 w-4" />
              Join meeting
            </a>
          ) : null}
          <DetailRow icon={Clock}>
            <p>{when.timeLabel}</p>
            <small>
              {when.zone}
              {when.duration ? ` · ${when.duration}` : ''}
              {' · US Central'}
            </small>
          </DetailRow>
          {event.location ? (
            <DetailRow icon={MapPin}>
              <p>{event.location}</p>
            </DetailRow>
          ) : null}
          <DetailRow icon={CalendarDays}>
            <p>{calendarLabel}</p>
            <small>{calendarEmail}</small>
          </DetailRow>
          {event.organizerEmail || event.organizerName ? (
            <DetailRow icon={Users}>
              <p>
                Organizer · {event.organizerName || event.organizerEmail}
              </p>
              {event.organizerEmail ? <small>{event.organizerEmail}</small> : null}
            </DetailRow>
          ) : null}
          {guests.length > 0 ? (
            <div className="iv-detail-guests">
              <p className="iv-detail-label">{guests.length} guest{guests.length === 1 ? '' : 's'}</p>
              <ul>
                {guests.map((guest) => (
                  <li key={guest.email}>
                    <EntityAvatar name={guest.name || guest.email} size="sm" />
                    <span>
                      <strong>{guest.name || guest.email}</strong>
                      <small>{guest.email}</small>
                    </span>
                    <em>{RSVP[guest.status]}</em>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {description ? (
            <div className="iv-detail-notes">
              <p className="iv-detail-label">Description</p>
              <pre>{description}</pre>
            </div>
          ) : null}
        </div>
        <div className="iv-detail-foot">
          {calendarUrl ? (
            <a className="iv-detail-open" href={calendarUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open in calendar
            </a>
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={close}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  children,
}: {
  icon: typeof Clock
  children: ReactNode
}) {
  return (
    <div className="iv-detail-row">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

function plainText(value: string | null | undefined) {
  if (!value?.trim()) {
    return ''
  }
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
