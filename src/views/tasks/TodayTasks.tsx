import { Check, RotateCcw } from 'lucide-react'

import { describeRepeat } from '../../lib/task-schedule'
import { PRIORITY_META } from './task-meta'
import type { TimelineEntry } from './task-timeline'

/** A member's to-do list for today: one click per task. */
export function TodayTasks({
  entries,
  pendingIds,
  onToggle,
  onOpen,
}: {
  entries: TimelineEntry[]
  pendingIds: Set<number>
  onToggle: (entry: TimelineEntry) => void
  onOpen: (id: number) => void
}) {
  const done = entries.filter((entry) => entry.doneByMe || entry.closed).length
  const allDone = entries.length > 0 && done === entries.length

  return (
    <section className={`td-panel${allDone ? ' is-all-done' : ''}`} aria-label="My tasks today">
      <header className="td-head">
        <div>
          <h2>My tasks today</h2>
          <p>
            {entries.length === 0
              ? 'Nothing assigned to you today.'
              : allDone
                ? 'All done for today. Nice work!'
                : `${done} of ${entries.length} done`}
          </p>
        </div>
        {entries.length > 0 ? (
          <div className="td-bar" aria-hidden="true">
            <i style={{ width: `${Math.round((done / entries.length) * 100)}%` }} />
          </div>
        ) : null}
      </header>

      {entries.length > 0 ? (
        <ul className="td-list">
          {entries.map((entry) => {
            const { task } = entry
            const finished = entry.doneByMe || entry.closed
            const busy = pendingIds.has(task.id)
            return (
              <li key={task.id} className={`td-row is-${PRIORITY_META[task.priority].tone}${finished ? ' is-done' : ''}`}>
                <button type="button" className="td-title" onClick={() => onOpen(task.id)} title="Open details">
                  <strong>{task.title}</strong>
                  <span>
                    {task.key}
                    {task.repeat !== 'NONE' ? ` · ${describeRepeat(task)}` : ''}
                  </span>
                </button>
                {entry.closed ? (
                  <span className="td-state">
                    <Check className="h-4 w-4" aria-hidden="true" /> Completed
                  </span>
                ) : finished ? (
                  <button
                    type="button"
                    className="td-btn is-done"
                    disabled={busy}
                    onClick={() => onToggle(entry)}
                    title="Undo"
                  >
                    <Check className="h-4 w-4 td-icon-done" aria-hidden="true" />
                    <RotateCcw className="h-4 w-4 td-icon-undo" aria-hidden="true" />
                    <span className="td-label-done">Done</span>
                    <span className="td-label-undo">Undo</span>
                  </button>
                ) : (
                  <button type="button" className="td-btn" disabled={busy} onClick={() => onToggle(entry)}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Complete
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
