import { AlertTriangle, CalendarClock, Check, MessageSquare, Plus, Repeat } from 'lucide-react'

import { describeRepeat, shortDate } from '../../lib/task-schedule'
import { AvatarStack } from './task-bits'
import { PRIORITY_META } from './task-meta'
import type { TimelineDay, TimelineEntry } from './task-timeline'

function shortRepeat(task: TimelineEntry['task']) {
  const text = describeRepeat(task)
  if (text === 'Every day') return 'Daily'
  if (text === 'Every work day') return 'Work days'
  return text.replace(/^Every /, '')
}

/** The single most useful status line for a card. */
function cardChip(entry: TimelineEntry) {
  const { task, note } = entry
  if (entry.closed) return { tone: 'complete', Icon: Check, label: 'Completed', title: 'Completed by admin' }
  if (entry.teamDone) return { tone: 'ready', Icon: Check, label: 'Ready', title: 'Every assignee is done · ready to complete' }
  if (entry.doneByMe) return { tone: 'ready', Icon: Check, label: 'Done', title: 'You are done · awaiting admin' }
  if (note) {
    return { tone: note.tone, Icon: note.tone === 'overdue' ? AlertTriangle : CalendarClock, label: note.label, title: note.label }
  }
  if (task.repeat !== 'NONE') {
    const until = task.endDate ? ` until ${shortDate(task.endDate)}` : ''
    return { tone: 'repeat', Icon: Repeat, label: shortRepeat(task), title: `${describeRepeat(task)}${until}` }
  }
  if (task.status === 'IN_PROGRESS') return { tone: 'progress', Icon: CalendarClock, label: 'In progress', title: 'In progress' }
  return null
}

function TimelineCard({
  entry,
  onOpen,
  onToggle,
}: {
  entry: TimelineEntry
  onOpen: (id: number) => void
  onToggle: (entry: TimelineEntry) => void
}) {
  const { task, done, isNew } = entry
  const priority = PRIORITY_META[task.priority]
  const assigned = task.assignees.length
  const chip = cardChip(entry)
  const checkTitle = entry.closed
    ? 'Completed by admin'
    : !entry.canCheck
      ? 'You can complete this on the day'
      : entry.doneByMe
        ? 'Undo my daily task'
        : 'Complete my daily task'

  return (
    <article
      className={`tl-card is-${priority.tone}${done ? ' is-done' : ''}${isNew && !done ? ' is-new' : ''}`}
    >
      <button type="button" className="tl-hit" onClick={() => onOpen(task.id)}>
        <span className="sr-only">Open {task.key}</span>
      </button>

      <header className="tl-card-top">
        <span className={`tl-prio-dot is-${priority.tone}`} title={`${priority.label} priority`} aria-label={`${priority.label} priority`} />
        <span className="tsk-key">{task.key}</span>
        {isNew && !done ? <span className="tl-new">New</span> : null}
        {entry.mine ? (
          <button
            type="button"
            className={`tl-done-btn${entry.doneByMe || entry.closed ? ' is-on' : ''}`}
            aria-pressed={entry.doneByMe || entry.closed}
            aria-label={`${checkTitle} (${task.key})`}
            title={checkTitle}
            disabled={!entry.canCheck}
            onClick={() => onToggle(entry)}
          >
            <Check className="h-3 w-3" aria-hidden="true" />
            {entry.doneByMe || entry.closed ? 'Done' : 'Complete'}
          </button>
        ) : entry.closed ? (
          <span className="tl-closed" title="Completed">
            <Check className="h-3 w-3" aria-hidden="true" />
          </span>
        ) : assigned > 0 ? (
          <span
            className={`tl-progress${entry.teamDone ? ' is-full' : ''}`}
            title={`${entry.doneBy.length} of ${assigned} assignees done`}
          >
            {entry.doneBy.length}/{assigned}
          </span>
        ) : null}
      </header>

      <h4 className="tl-title" title={task.description ?? undefined}>
        {task.title}
      </h4>

      <footer className="tl-foot">
        {chip ? (
          <span className={`tl-chip is-${chip.tone}`} title={chip.title}>
            <chip.Icon className="h-3 w-3" aria-hidden="true" />
            {chip.label}
          </span>
        ) : null}
        {task.commentCount > 0 ? (
          <span className="tl-comments" title={`${task.commentCount} comments`}>
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            {task.commentCount}
          </span>
        ) : null}
        <span className="tl-people">
          <AvatarStack people={task.assignees} doneIds={entry.doneBy} />
        </span>
      </footer>
    </article>
  )
}

export function TaskTimeline({
  days,
  onOpen,
  onToggle,
  onAdd,
}: {
  days: TimelineDay[]
  onOpen: (id: number) => void
  onToggle: (entry: TimelineEntry) => void
  /** Omitted for members, who can't create tasks. */
  onAdd?: (date: string) => void
}) {
  return (
    <div className="tl-board">
      {days.map((day) => {
        const total = day.entries.length
        const progress = total === 0 ? 0 : Math.round((day.done / total) * 100)
        return (
          <section
            key={day.date}
            className={`tl-day${day.isToday ? ' is-today' : ''}${day.isPast ? ' is-past' : ''}`}
            aria-label={`${day.label} ${shortDate(day.date)}`}
          >
            <header className="tl-day-head">
              <div className="tl-day-name">
                <strong>{day.label}</strong>
                <span>{shortDate(day.date)}</span>
                {day.isToday ? <em>Today</em> : null}
              </div>
              <span className="tl-day-count" title={`${day.done} of ${total} done`}>
                {total === 0 ? '0' : `${day.done}/${total}`}
              </span>
              {onAdd ? (
                <button
                  type="button"
                  className="tl-day-add"
                  onClick={() => onAdd(day.date)}
                  aria-label={`Add a task on ${day.label} ${shortDate(day.date)}`}
                  title="Add a task on this day"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
              <div className="tl-day-bar" aria-hidden="true">
                <i style={{ width: `${progress}%` }} />
              </div>
            </header>

            <div className="tl-day-list">
              {total === 0 && onAdd ? (
                <button type="button" className="tl-empty" onClick={() => onAdd(day.date)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nothing planned
                </button>
              ) : total === 0 ? (
                <div className="tl-empty is-static">Nothing planned</div>
              ) : (
                day.entries.map((entry) => (
                  <TimelineCard key={`${entry.task.id}-${entry.date}`} entry={entry} onOpen={onOpen} onToggle={onToggle} />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
