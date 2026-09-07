export const INTERVIEW_STATUSES = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NO_SHOW', label: 'No show' },
] as const

export const INTERVIEW_METHODS = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'ONSITE', label: 'On-site' },
  { value: 'OTHER', label: 'Other' },
] as const

export function interviewStatusLabel(status: string | null | undefined) {
  return INTERVIEW_STATUSES.find((row) => row.value === status)?.label ?? status ?? '—'
}

export function interviewMethodLabel(method: string | null | undefined) {
  return INTERVIEW_METHODS.find((row) => row.value === method)?.label ?? method ?? '—'
}
