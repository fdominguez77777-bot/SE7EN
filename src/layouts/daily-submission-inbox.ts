import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../api/client'

export const DAILY_SUBMISSION_INBOX_EVENT = 'daily-submission-inbox'

const POLL_MS = 60_000
const MIN_GAP_MS = 15_000

export function notifyDailySubmissionInbox() {
  window.dispatchEvent(new Event(DAILY_SUBMISSION_INBOX_EVENT))
}

export function useDailySubmissionInbox(enabled: boolean) {
  const [count, setCount] = useState(0)
  const lastAt = useRef(0)
  const inflight = useRef<Promise<void> | null>(null)

  const refresh = useCallback((force = false) => {
    if (!enabled) {
      setCount(0)
      return
    }
    if (typeof document !== 'undefined' && document.hidden && !force) {
      return
    }
    if (!force && Date.now() - lastAt.current < MIN_GAP_MS) {
      return
    }
    if (inflight.current) {
      return inflight.current
    }
    lastAt.current = Date.now()
    inflight.current = api
      .get<{ count: number }>('/daily-submissions/unread-count')
      .then(({ data }) => setCount(data.count))
      .catch(() => {
        setCount(0)
      })
      .finally(() => {
        inflight.current = null
      })
    return inflight.current
  }, [enabled])

  useEffect(() => {
    refresh(true)
    if (!enabled) {
      return
    }
    const onInbox = () => refresh(true)
    const timer = window.setInterval(() => refresh(), POLL_MS)
    window.addEventListener(DAILY_SUBMISSION_INBOX_EVENT, onInbox)
    window.addEventListener('focus', onInbox)
    const onVisible = () => {
      if (!document.hidden) {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(DAILY_SUBMISSION_INBOX_EVENT, onInbox)
      window.removeEventListener('focus', onInbox)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, refresh])

  return count
}
