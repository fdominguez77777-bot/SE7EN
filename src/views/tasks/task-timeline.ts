import type { TaskItem } from '../../api/types'
import { addDays, occursOn, shortDate, weekdayIndex, WEEKDAY_LABELS, workWeek } from '../../lib/task-schedule'

const NEW_WINDOW_MS = 24 * 60 * 60 * 1000

export type TimelineEntry = {
  task: TaskItem
  date: string
  done: boolean
  isNew: boolean
  /** Shown instead of the schedule when the card sits on a different day than planned. */
  note: { label: string; tone: 'overdue' | 'moved' } | null
}

export type TimelineDay = {
  date: string
  label: string
  isToday: boolean
  isPast: boolean
  entries: TimelineEntry[]
  done: number
}

function localIso(value: string) {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function stamp(task: TaskItem) {
  return new Date(task.assignedAt ?? task.created_at).getTime()
}

function isFresh(task: TaskItem, actorId: number | undefined, now: number) {
  if (!task.assignedAt || task.reporter?.id === actorId) return false
  return now - new Date(task.assignedAt).getTime() < NEW_WINDOW_MS
}

/** Which Mon–Fri column a one-time task belongs in for this week, if any. */
function oneTimePlacement(task: TaskItem, week: string[], today: string) {
  const due = task.dueDate
  if (!due) return null
  const monday = week[0]
  const friday = week[4]
  const sunday = addDays(monday, 6)
  const open = task.status !== 'DONE'
  const weekHasToday = today >= monday && today <= sunday
  if (open && due < today && weekHasToday) {
    const day = today > friday ? friday : today
    return { date: day, note: { label: `Overdue · ${shortDate(due)}`, tone: 'overdue' as const } }
  }
  if (due < monday || due > sunday) return null
  if (due > friday) {
    return { date: friday, note: { label: `Due ${WEEKDAY_LABELS[weekdayIndex(due)]} ${shortDate(due)}`, tone: 'moved' as const } }
  }
  if (open && due < today) {
    return { date: due, note: { label: 'Overdue', tone: 'overdue' as const } }
  }
  return { date: due, note: null }
}

export function buildTimeline(
  tasks: TaskItem[],
  monday: string,
  today: string,
  actorId: number | undefined,
  now = Date.now(),
): TimelineDay[] {
  const week = workWeek(monday)
  const byDay = new Map<string, TimelineEntry[]>(week.map((date) => [date, []]))

  for (const task of tasks) {
    const isNew = isFresh(task, actorId, now)
    if (task.repeat === 'NONE') {
      const placement = oneTimePlacement(task, week, today)
      if (placement) {
        byDay.get(placement.date)?.push({
          task,
          date: placement.date,
          done: task.status === 'DONE',
          isNew,
          note: placement.note,
        })
      }
      continue
    }
    const closedOn = task.status === 'DONE' && task.completedAt ? localIso(task.completedAt) : null
    for (const date of week) {
      if (closedOn && date > closedOn) continue
      if (!occursOn(task, date)) continue
      byDay.get(date)?.push({
        task,
        date,
        done: closedOn !== null || task.completedOn.includes(date),
        isNew,
        note: null,
      })
    }
  }

  return week.map((date, index) => {
    const entries = (byDay.get(date) ?? []).sort((left, right) => {
      if (left.done !== right.done) return left.done ? 1 : -1
      return stamp(right.task) - stamp(left.task) || right.task.id - left.task.id
    })
    return {
      date,
      label: WEEKDAY_LABELS[index],
      isToday: date === today,
      isPast: date < today,
      entries,
      done: entries.filter((entry) => entry.done).length,
    }
  })
}
