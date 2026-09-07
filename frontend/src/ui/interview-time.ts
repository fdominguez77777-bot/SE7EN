import type { Interview } from '../api/types'

export function isUpcomingInterview(item: Interview, now = Date.now()) {
  return (
    (item.status || 'SCHEDULED') === 'SCHEDULED' &&
    new Date(item.startsAt).getTime() >= now
  )
}

export function formatInterviewWhen(iso: string) {
  const date = new Date(iso)
  return {
    date: date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

export function toDatetimeLocal(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
