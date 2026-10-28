export const ScheduleKind = {
  FIRST: 'FIRST',
  NEXT: 'NEXT',
  OTHER: 'OTHER',
} as const

export type ScheduleKindName = (typeof ScheduleKind)[keyof typeof ScheduleKind]

export const SCHEDULE_KINDS: ScheduleKindName[] = [
  ScheduleKind.FIRST,
  ScheduleKind.NEXT,
  ScheduleKind.OTHER,
]

export const SCHEDULE_KIND_OPTIONS: Array<{
  value: ScheduleKindName
  label: string
  hint: string
}> = [
  { value: ScheduleKind.FIRST, label: 'First round', hint: 'Exact interview' },
  { value: ScheduleKind.NEXT, label: 'Next round', hint: 'A later round' },
  {
    value: ScheduleKind.OTHER,
    label: 'Other',
    hint: 'Non-tech or manager role',
  },
]

/** Unset schedules count as a first-round interview. */
export function scheduleKindOf(kind: string | null | undefined): ScheduleKindName {
  if (kind === ScheduleKind.NEXT || kind === ScheduleKind.OTHER) {
    return kind
  }
  return ScheduleKind.FIRST
}

export function isExactSchedule(kind: string | null | undefined) {
  return scheduleKindOf(kind) === ScheduleKind.FIRST
}

export function scheduleKindLabel(kind: string | null | undefined) {
  const value = scheduleKindOf(kind)
  return SCHEDULE_KIND_OPTIONS.find((option) => option.value === value)?.label ?? 'First round'
}

/** Calendar event ids are `{accountId}:{upstreamId}`. */
export function calendarEventAccountId(eventKey: string): number | null {
  const split = eventKey.indexOf(':')
  if (split <= 0) {
    return null
  }
  const accountId = Number(eventKey.slice(0, split))
  const upstream = eventKey.slice(split + 1).trim()
  if (!Number.isInteger(accountId) || accountId < 1 || !upstream) {
    return null
  }
  return accountId
}
