import { weekRange } from './reporting-period'

export const JOB_APPLICATION_STATUSES = [
  { value: 'APPLIED', label: 'Applied' },
  { value: 'INTERVIEWING', label: 'Interviewing' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
] as const

export const JOB_APPLICATION_SOURCES = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'HIRINGCAFE', label: 'HiringCafe' },
  { value: 'REMOTEYEAH', label: 'RemoteYeah' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'TALYN', label: 'Talyn' },
  { value: 'OTHER', label: 'Other' },
] as const

export function jobApplicationStatusLabel(status: string) {
  const known = JOB_APPLICATION_STATUSES.find((row) => row.value === status)
  if (known) {
    return known.label
  }
  const trimmed = status.trim()
  if (!trimmed) {
    return '—'
  }
  return trimmed.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function jobApplicationSourceLabel(source: string) {
  return JOB_APPLICATION_SOURCES.find((row) => row.value === source)?.label ?? source
}

export function safeHttpUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return null
  }
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.href
  } catch {
    return null
  }
}

export function inLocalToday(iso: string) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const time = new Date(iso).getTime()
  return time >= start.getTime() && time < end.getTime()
}

export function inCurrentWeek(iso: string) {
  const range = weekRange('current')
  const time = new Date(iso).getTime()
  return time >= range.from.getTime() && time < range.to.getTime()
}

export function inPreviousWeek(iso: string) {
  const range = weekRange('previous')
  const time = new Date(iso).getTime()
  return time >= range.from.getTime() && time < range.to.getTime()
}
