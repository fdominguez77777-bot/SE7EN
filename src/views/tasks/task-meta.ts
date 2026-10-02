import type { TaskActivityEntry, TaskPerson, TaskPriority, TaskStatus } from '../../api/types'

export const STATUS_ORDER: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']
export const PRIORITY_ORDER: TaskPriority[] = ['HIGH', 'MEDIUM', 'LOW']

export const STATUS_META: Record<TaskStatus, { label: string; tone: string }> = {
  TODO: { label: 'Open', tone: 'todo' },
  IN_PROGRESS: { label: 'In progress', tone: 'progress' },
  DONE: { label: 'Resolved', tone: 'done' },
}

export const PRIORITY_META: Record<TaskPriority, { label: string; tone: string }> = {
  HIGH: { label: 'High', tone: 'high' },
  MEDIUM: { label: 'Medium', tone: 'medium' },
  LOW: { label: 'Low', tone: 'low' },
}

export function assigneeSummary(people: TaskPerson[]) {
  if (people.length === 0) return 'Unassigned'
  const first = people[0].name.split(/\s+/)[0]
  if (people.length === 1) return people[0].name
  if (people.length === 2) return `${first} & ${people[1].name.split(/\s+/)[0]}`
  return `${first} +${people.length - 1}`
}

export function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function shiftIso(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function dueInfo(dueDate: string | null, status: TaskStatus, today = todayIso()) {
  if (!dueDate) {
    return null
  }
  const overdue = status !== 'DONE' && dueDate < today
  let label: string
  if (dueDate === today) {
    label = 'Today'
  } else if (dueDate === shiftIso(today, 1)) {
    label = 'Tomorrow'
  } else {
    const [y, m, d] = dueDate.split('-').map(Number)
    label = new Date(y, m - 1, d).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(dueDate.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
    })
  }
  return { label, overdue }
}

export function relativeTime(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function labelFor(kind: TaskActivityEntry['kind'], value: string | null) {
  if (!value) return null
  if (kind === 'STATUS') return STATUS_META[value as TaskStatus]?.label ?? value
  if (kind === 'PRIORITY') return PRIORITY_META[value as TaskPriority]?.label ?? value
  if (kind === 'DUE_DATE') return dueInfo(value, 'TODO')?.label ?? value
  return value
}

function occurrenceLabel(iso: string | null) {
  if (!iso) return 'the day'
  const today = todayIso()
  if (iso === today) return 'today'
  if (iso === shiftIso(today, -1)) return 'yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Sentence fragment rendered after the actor's name, e.g. "moved this to Done". */
export function describeActivity(entry: TaskActivityEntry) {
  const to = labelFor(entry.kind, entry.toValue)
  const from = labelFor(entry.kind, entry.fromValue)
  switch (entry.kind) {
    case 'CREATED':
      return to ? `opened this ticket for ${to}` : 'opened this ticket'
    case 'STATUS':
      return `moved this to ${to}`
    case 'ASSIGNEE':
      if (to && from) return `assigned ${to} and removed ${from}`
      return to ? `assigned ${to}` : `removed ${from}`
    case 'PRIORITY':
      return `set priority to ${to}`
    case 'DUE_DATE':
      return to ? `set the due date to ${to}` : 'removed the due date'
    case 'TITLE':
      return 'changed the subject'
    case 'DESCRIPTION':
      return 'updated the description'
    case 'SCHEDULE':
      return `set the schedule to “${to ?? 'One time'}”`
    case 'COMPLETED':
      return `completed this for ${occurrenceLabel(entry.toValue)}`
    case 'REOPENED':
      return `reopened this for ${occurrenceLabel(entry.toValue)}`
    default:
      return 'updated the task'
  }
}
