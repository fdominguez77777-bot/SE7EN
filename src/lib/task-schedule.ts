export const TASK_REPEATS = ['NONE', 'DAILY', 'WEEKDAYS', 'CUSTOM'] as const
export type TaskRepeat = (typeof TASK_REPEATS)[number]

/** Bit per weekday, Monday first: Mon=1, Tue=2 … Sun=64. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const ALL_DAYS_MASK = 127
export const WORKDAYS_MASK = 31

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export type TaskSchedule = {
  repeat: TaskRepeat
  repeatDays: number | null
  startDate: string
  endDate: string | null
  dueDate: string | null
}

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toIso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { y, m, d } = parts(value)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function addDays(iso: string, days: number) {
  const { y, m, d } = parts(iso)
  return toIso(new Date(Date.UTC(y, m - 1, d + days)))
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string) {
  const { y, m, d } = parts(iso)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

export function mondayOf(iso: string) {
  return addDays(iso, -weekdayIndex(iso))
}

export function workWeek(monday: string) {
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset))
}

export function shortDate(iso: string) {
  const { m, d } = parts(iso)
  return `${MONTHS[m - 1]} ${d}`
}

export function repeatMask(schedule: Pick<TaskSchedule, 'repeat' | 'repeatDays'>) {
  if (schedule.repeat === 'DAILY') return ALL_DAYS_MASK
  if (schedule.repeat === 'WEEKDAYS') return WORKDAYS_MASK
  if (schedule.repeat === 'CUSTOM') return (schedule.repeatDays ?? 0) & ALL_DAYS_MASK
  return 0
}

export function occursOn(schedule: TaskSchedule, iso: string) {
  if (schedule.repeat === 'NONE') {
    return schedule.dueDate === iso
  }
  if (iso < schedule.startDate) return false
  if (schedule.endDate && iso > schedule.endDate) return false
  return (repeatMask(schedule) & (1 << weekdayIndex(iso))) !== 0
}

export function describeRepeat(schedule: Pick<TaskSchedule, 'repeat' | 'repeatDays'>) {
  if (schedule.repeat === 'DAILY') return 'Every day'
  if (schedule.repeat === 'WEEKDAYS') return 'Every work day'
  if (schedule.repeat === 'CUSTOM') {
    const mask = repeatMask(schedule)
    if (mask === WORKDAYS_MASK) return 'Every work day'
    if (mask === ALL_DAYS_MASK) return 'Every day'
    return `Every ${WEEKDAY_LABELS.filter((_, index) => mask & (1 << index)).join(', ')}`
  }
  return 'One time'
}

export function describeSchedule(schedule: TaskSchedule) {
  if (schedule.repeat === 'NONE') {
    return schedule.dueDate ? `Due ${shortDate(schedule.dueDate)}` : 'One time'
  }
  const base = describeRepeat(schedule)
  return schedule.endDate ? `${base} until ${shortDate(schedule.endDate)}` : base
}

export function scheduleProblem(schedule: TaskSchedule): string | null {
  if (!TASK_REPEATS.includes(schedule.repeat)) return 'Choose how often the task repeats.'
  if (!isIsoDate(schedule.startDate)) return 'Start date must be a valid date.'
  if (schedule.repeat === 'NONE') {
    if (!schedule.dueDate || !isIsoDate(schedule.dueDate)) return 'Pick the day this task is due.'
    return null
  }
  if (schedule.repeat === 'CUSTOM' && repeatMask(schedule) === 0) return 'Pick at least one day of the week.'
  if (schedule.endDate) {
    if (!isIsoDate(schedule.endDate)) return 'End date must be a valid date.'
    if (schedule.endDate < schedule.startDate) return 'End date must be on or after the start date.'
  }
  return null
}
