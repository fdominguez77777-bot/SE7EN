import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Clock, ExternalLink, MapPin, Users, Video, X } from 'lucide-react'

import type { CalendarBidder, CalendarEvent, CalendarGuest } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from './avatar'
import { formatEventWhen } from './calendar-week'
import { Button } from './chrome'
import { safeHttpUrl } from './job-application'
import { descriptionToPlainText, firstHttpUrl, splitLinkedText } from './text-links'

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
  const { user } = useAuth()
  const canJoinMeeting = user?.role === 'ADMIN'
  const when = formatEventWhen(event.start, event.end, event.allDay)
  const description = descriptionToPlainText(event.description)
  const joinUrl = safeHttpUrl(event.joinUrl) ?? firstHttpUrl(description)
  const calendarUrl = safeHttpUrl(event.htmlLink)
  const guests = event.guests ?? []
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
          {canJoinMeeting && joinUrl ? (
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
              <LinkedText text={event.location} as="p" />
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
              <LinkedText text={description} as="pre" />
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

function LinkedText({
  text,
  as: Tag,
}: {
  text: string
  as: 'pre' | 'p'
}) {
  return (
    <Tag>
      {splitLinkedText(text).map((part, index) =>
        part.href ? (
          <a key={`${part.href}-${index}`} href={part.href} target="_blank" rel="noreferrer">
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </Tag>
  )
}
