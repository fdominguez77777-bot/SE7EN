import { AlertTriangle, CalendarClock, Check, MessageSquare, Plus, Repeat } from 'lucide-react'

import { describeRepeat, shortDate } from '../../lib/task-schedule'
import { AvatarStack } from './task-bits'
import { assigneeSummary, PRIORITY_META, STATUS_META } from './task-meta'
import type { TimelineDay, TimelineEntry } from './task-timeline'

function TimelineCard({
  entry,
  onOpen,
  onToggle,
}: {
  entry: TimelineEntry
  onOpen: (id: number) => void
  onToggle: (entry: TimelineEntry) => void
}) {
  const { task, done, isNew, note } = entry
  const priority = PRIORITY_META[task.priority]
  const recurring = task.repeat !== 'NONE'
  const inProgress = !done && task.status === 'IN_PROGRESS'

  return (
    <article
      className={`tl-card is-${priority.tone}${done ? ' is-done' : ''}${isNew && !done ? ' is-new' : ''}`}
    >
      <button type="button" className="tl-hit" onClick={() => onOpen(task.id)}>
        <span className="sr-only">Open {task.key}</span>
      </button>

      <header className="tl-card-top">
        <span className="tsk-key">{task.key}</span>
        {isNew && !done ? <span className="tl-new">New</span> : null}
        <span className={`tl-prio is-${priority.tone}`}>{priority.label}</span>
        <button
          type="button"
          className="tl-check"
          aria-pressed={done}
          aria-label={done ? `Mark ${task.key} not done` : `Mark ${task.key} done`}
          title={done ? 'Mark not done' : recurring ? 'Done for this day' : 'Mark done'}
          onClick={() => onToggle(entry)}
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      <h4 className="tl-title">{task.title}</h4>
      {task.description ? <p className="tl-desc">{task.description}</p> : null}

      <div className="tl-tags">
        {note ? (
          <span className={`tl-chip is-${note.tone}`}>
            {note.tone === 'overdue' ? (
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            ) : (
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
            )}
            {note.label}
          </span>
        ) : null}
        {recurring ? (
          <span className="tl-chip is-repeat" title={task.endDate ? `Until ${shortDate(task.endDate)}` : 'No end date'}>
            <Repeat className="h-3 w-3" aria-hidden="true" />
            {describeRepeat(task)}
            {task.endDate ? <em>until {shortDate(task.endDate)}</em> : null}
          </span>
        ) : null}
        {inProgress ? <span className="tl-chip is-progress">{STATUS_META.IN_PROGRESS.label}</span> : null}
      </div>

      <footer className="tl-foot">
        <span className="tl-people" title={task.assignees.map((person) => person.name).join(', ') || 'Unassigned'}>
          <AvatarStack people={task.assignees} />
          <span className={task.assignees.length > 0 ? '' : 'is-empty'}>{assigneeSummary(task.assignees)}</span>
        </span>
        {task.commentCount > 0 ? (
          <span className="tl-comments" title={`${task.commentCount} comments`}>
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {task.commentCount}
          </span>
        ) : null}
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
  onAdd: (date: string) => void
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
              <button
                type="button"
                className="tl-day-add"
                onClick={() => onAdd(day.date)}
                aria-label={`Add a task on ${day.label} ${shortDate(day.date)}`}
                title="Add a task on this day"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="tl-day-bar" aria-hidden="true">
                <i style={{ width: `${progress}%` }} />
              </div>
            </header>

            <div className="tl-day-list">
              {total === 0 ? (
                <button type="button" className="tl-empty" onClick={() => onAdd(day.date)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Nothing planned
                </button>
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
