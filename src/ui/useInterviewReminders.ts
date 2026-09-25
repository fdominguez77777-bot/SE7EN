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

const POLL_MS = 2 * 60_000
const LEAD_MS = 10 * 60_000
const SEEN_KEY = 'bp_interview_reminded'

function loadSeen() {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]') as string[])
  } catch {
    return new Set<string>()
  }
}

/** Windows notification shortly before each interview; only runs inside the desktop app. */
export function useInterviewReminders(enabled: boolean) {
  useEffect(() => {
    const bridge = typeof window === 'undefined' ? undefined : window.se7enDesktop
    if (!enabled || !bridge) {
      return
    }
    const seen = loadSeen()
    let cancelled = false

    async function check() {
      const now = Date.now()
      try {
        const { data } = await api.get<CalendarEvent[] | { events: CalendarEvent[] }>(
          '/calendar/events',
          {
            params: {
              from: new Date(now).toISOString(),
              to: new Date(now + LEAD_MS + POLL_MS).toISOString(),
            },
          },
        )
        if (cancelled || !bridge) {
          return
        }
        const events = Array.isArray(data) ? data : data?.events ?? []
        for (const event of events) {
          if (event.allDay || seen.has(event.id)) {
            continue
          }
          const startsIn = new Date(event.start).getTime() - now
          if (startsIn < 0 || startsIn > LEAD_MS) {
            continue
          }
          seen.add(event.id)
          const minutes = Math.max(1, Math.round(startsIn / 60_000))
          const who = event.profileName ? ` · ${event.profileName}` : ''
          bridge.notify(
            `Interview in ${minutes} min`,
            `${event.title}${who}\n${formatEventTime(event.start, event.end)}`,
            '/interviews',
          )
        }
        sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
      } catch {
        // Reminders are best-effort; the next poll retries.
      }
    }

    void check()
    const timer = window.setInterval(() => void check(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled])
}
