import { useCallback, useEffect, useState } from 'react'

import { api } from '../api/client'

export const DAILY_SUBMISSION_INBOX_EVENT = 'daily-submission-inbox'

export function notifyDailySubmissionInbox() {
  window.dispatchEvent(new Event(DAILY_SUBMISSION_INBOX_EVENT))
}

export function useDailySubmissionInbox(enabled: boolean) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    api
      .get<{ count: number }>('/daily-submissions/unread-count')
      .then(({ data }) => setCount(data.count))
      .catch(() => {
        setCount(0)
      })
  }, [enabled])

  useEffect(() => {
    refresh()
    if (!enabled) {
      return
    }
    const onInbox = () => refresh()
    const timer = window.setInterval(refresh, 20000)
    window.addEventListener(DAILY_SUBMISSION_INBOX_EVENT, onInbox)
    window.addEventListener('focus', onInbox)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(DAILY_SUBMISSION_INBOX_EVENT, onInbox)
      window.removeEventListener('focus', onInbox)
    }
  }, [enabled, refresh])

  return count
}
