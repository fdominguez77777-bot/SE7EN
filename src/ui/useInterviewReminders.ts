import { useEffect } from 'react'

import { api } from '../api/client'
import type { CalendarEvent } from '../api/types'
import { formatEventTime } from './calendar-week'

type DesktopBridge = {
  isDesktop: true
  notify: (title: string, body: string, route?: string) => void
}

declare global {
  interface Window {
    se7enDesktop?: DesktopBridge
  }
}

const POLL_MS = 3 * 60_000
const LEAD_MS = 10 * 60_000
const LOOKAHEAD_MS = 60 * 60_000
const SEEN_KEY = 'bp_interview_reminded'

function loadSeen() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

function reminderKey(event: CalendarEvent) {
  return `${event.id}@${event.start}`
}

/** Windows notification 10 minutes before each interview; only runs inside the desktop app. */
export function useInterviewReminders(enabled: boolean) {
  useEffect(() => {
    const bridge = typeof window === 'undefined' ? undefined : window.se7enDesktop
    if (!enabled || !bridge) {
      return
    }
    const seen = loadSeen()
    const timers = new Map<string, number>()
    let cancelled = false

    function remind(event: CalendarEvent) {
      const key = reminderKey(event)
      timers.delete(key)
      if (cancelled || seen.has(key) || !bridge) {
        return
      }
      seen.add(key)
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)))
      const minutes = Math.max(1, Math.round((new Date(event.start).getTime() - Date.now()) / 60_000))
      const who = event.profileName ? ` · ${event.profileName}` : ''
      bridge.notify(
        `Interview in ${minutes} min`,
        `${event.title}${who}\n${formatEventTime(event.start, event.end)}`,
        '/interviews',
      )
    }

    async function check() {
      const now = Date.now()
      try {
        const { data } = await api.get<CalendarEvent[] | { events: CalendarEvent[] }>(
          '/calendar/events',
          {
            params: {
              from: new Date(now).toISOString(),
              to: new Date(now + LOOKAHEAD_MS).toISOString(),
            },
          },
        )
        if (cancelled) {
          return
        }
        const events = Array.isArray(data) ? data : data?.events ?? []
        for (const event of events) {
          const key = reminderKey(event)
          if (event.allDay || seen.has(key) || timers.has(key)) {
            continue
          }
          const startsAt = new Date(event.start).getTime()
          if (!Number.isFinite(startsAt) || startsAt <= now) {
            continue
          }
          const fireIn = startsAt - LEAD_MS - now
          if (fireIn <= 0) {
            remind(event)
          } else {
            timers.set(key, window.setTimeout(() => remind(event), fireIn))
          }
        }
      } catch {
        // Reminders are best-effort; the next poll retries.
      }
    }

    void check()
    const poll = window.setInterval(() => void check(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(poll)
      for (const timer of timers.values()) {
        window.clearTimeout(timer)
      }
    }
  }, [enabled])
}
