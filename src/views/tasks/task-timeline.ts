import type { TaskItem } from '../../api/types'
import { addDays, occursOn, shortDate, weekdayIndex, WEEKDAY_LABELS, workWeek } from '../../lib/task-schedule'

const NEW_WINDOW_MS = 24 * 60 * 60 * 1000

export type TimelineEntry = {
  task: TaskItem
  date: string
  /** An admin completed the whole task. */
  closed: boolean
  /** The viewer is an assignee, so this is their own daily task. */
  mine: boolean
  /** Assignees who completed their part for this day. */
  doneBy: number[]
  doneByMe: boolean
  /** Every assignee is done, waiting for an admin to complete the task. */
  teamDone: boolean
  /** Shown faded and sorted to the bottom. */
  done: boolean
  canCheck: boolean
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

function stamp(task: TaskItem) {
  return new Date(task.assignedAt ?? task.created_at).getTime()
}

function isFresh(task: TaskItem, actorId: number | undefined, now: number) {
  if (!task.assignedAt || task.reporter?.id === actorId) return false
  return now - new Date(task.assignedAt).getTime() < NEW_WINDOW_MS
}

/** Which Mon–Fri column a one-time task belongs in for this week, if any. */
function oneTimePlacement(task: TaskItem, week: string[], today: string, myDoneOn: string | null) {
  const due = task.dueDate
  if (!due) return null
  const monday = week[0]
  const friday = week[4]
  const sunday = addDays(monday, 6)
  const open = task.status !== 'DONE'
  if (open && myDoneOn) {
    const day = myDoneOn > due ? myDoneOn : due
    if (day < monday || day > sunday) return null
    return { date: day > friday ? friday : day, note: null }
  }
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

  function entry(task: TaskItem, date: string, closed: boolean, doneBy: number[], note: TimelineEntry['note']) {
    const assigneeIds = task.assignees.map((person) => person.id)
    const mine = actorId !== undefined && assigneeIds.includes(actorId)
    const doneByMe = mine && doneBy.includes(actorId as number)
    const teamDone = assigneeIds.length > 0 && assigneeIds.every((id) => doneBy.includes(id))
    const item: TimelineEntry = {
      task,
      date,
      closed,
      mine,
      doneBy,
      doneByMe,
      teamDone,
      done: closed || doneByMe,
      canCheck: mine && !closed && (task.repeat === 'NONE' || date <= today),
      isNew: isFresh(task, actorId, now),
      note: closed || doneByMe || teamDone ? null : note,
    }
    byDay.get(date)?.push(item)
  }

  for (const task of tasks) {
    const closed = task.status === 'DONE'
    if (closed) continue
    const assigneeIds = new Set(task.assignees.map((person) => person.id))
    if (task.repeat === 'NONE') {
      const doneBy = [...new Set(task.completions.map((row) => row.userId))].filter((id) => assigneeIds.has(id))
      const myDoneOn = task.completions.find((row) => row.userId === actorId)?.date ?? null
      const placement = oneTimePlacement(task, week, today, myDoneOn)
      if (placement) entry(task, placement.date, closed, doneBy, placement.note)
      continue
    }
    for (const date of week) {
      if (!occursOn(task, date)) continue
      const doneBy = task.completions
        .filter((row) => row.date === date && assigneeIds.has(row.userId))
        .map((row) => row.userId)
      entry(task, date, closed, doneBy, null)
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
      done: entries.filter((item) => item.done || item.teamDone).length,
    }
  })
}
