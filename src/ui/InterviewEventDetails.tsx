import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlignLeft, CalendarDays, Clock, ExternalLink, MapPin, Users, Video, X } from 'lucide-react'

import type { CalendarBidder, CalendarEvent, CalendarGuest } from '../api/types'
import { EntityAvatar } from './avatar'
import { formatEventWhen } from './calendar-week'
import { Button } from './chrome'
import { safeHttpUrl } from './job-application'
import {
  calendarDescriptionHtml,
  descriptionToPlainText,
  firstHttpUrl,
  isMeetingJoinUrl,
  splitLinkedText,
} from './text-links'

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
  const descriptionText = descriptionToPlainText(event.description)
  const descriptionHtml = calendarDescriptionHtml(event.description)
  const joinUrl = safeHttpUrl(event.joinUrl) ?? firstHttpUrl(descriptionText)
  const calendarUrl = safeHttpUrl(event.htmlLink)
  const guests = event.guests ?? []
  const calendarLabel = event.profileName?.trim() || owner?.name || event.email
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

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
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
        style={{ '--ev': owner?.color ?? event.color } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="iv-detail-title"
        onClick={(click) => click.stopPropagation()}
      >
        <div className="iv-detail-accent" />
        <div className="apps-modal-head">
          <div className="min-w-0">
            <p className="iv-detail-kicker">{when.dateLabel}</p>
            <h2 id="iv-detail-title" className="iv-detail-title">
              {event.title}
            </h2>
          </div>
          <div className="apps-modal-actions">
            <button type="button" className="apps-icon-btn" aria-label="Close" onClick={close}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="iv-detail-body">
          <DetailRow icon={Clock}>
            <p>{when.timeLabel}</p>
            <small>
              {when.zone}
              {when.duration ? ` · ${when.duration}` : ''}
            </small>
          </DetailRow>
          {joinUrl ? (
            <DetailRow icon={Video}>
              <p>
                <a className="iv-meet-link" href={joinUrl} target="_blank" rel="noreferrer">
                  {meetingLabel(joinUrl)}
                </a>
              </p>
              <small>
                <a className="iv-meet-link" href={joinUrl} target="_blank" rel="noreferrer">
                  {joinUrl.replace(/^https?:\/\//, '')}
                </a>
              </small>
            </DetailRow>
          ) : null}
          {event.location ? (
            <DetailRow icon={MapPin}>
              <LinkedText text={event.location} as="p" />
            </DetailRow>
          ) : null}
          {guests.length > 0 ? (
            <div className="iv-detail-guests">
              <Users className="h-4 w-4" aria-hidden="true" />
              <div>
                <p>
                  {guests.length} guest{guests.length === 1 ? '' : 's'}
                </p>
                <ul>
                  {guests.map((guest) => (
                    <li key={guest.email}>
                      <EntityAvatar name={guest.name || guest.email} size="sm" />
                      <span>
                        <strong>{guest.name || guest.email}</strong>
                        {guest.name && guest.name !== guest.email ? <small>{guest.email}</small> : null}
                      </span>
                      <em className={`iv-rsvp is-${guest.status}`}>{RSVP[guest.status]}</em>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          {descriptionHtml ? (
            <div className="iv-detail-notes">
              <AlignLeft className="h-4 w-4" aria-hidden="true" />
              <div
                className="iv-detail-copy"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </div>
          ) : null}
          <DetailRow icon={CalendarDays}>
            <p>{calendarLabel}</p>
            <small>
              {owner?.name && owner.name !== calendarLabel ? `${owner.name} · ` : ''}
              {calendarEmail}
            </small>
          </DetailRow>
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
    </div>,
    document.body,
  )
}

function meetingLabel(url: string) {
  const value = url.toLowerCase()
  if (value.includes('meet.google.com')) {
    return 'Join with Google Meet'
  }
  if (value.includes('zoom.us')) {
    return 'Join Zoom Meeting'
  }
  if (value.includes('teams.microsoft.com') || value.includes('teams.live.com')) {
    return 'Join Microsoft Teams Meeting'
  }
  if (value.includes('webex.com')) {
    return 'Join Webex meeting'
  }
  return 'Join meeting'
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
          <a
            key={`${part.href}-${index}`}
            className={isMeetingJoinUrl(part.href) ? 'iv-meet-link' : undefined}
            href={part.href}
            target="_blank"
            rel="noreferrer"
          >
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </Tag>
  )
}
