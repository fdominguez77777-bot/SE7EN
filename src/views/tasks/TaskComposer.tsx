import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'

import { api, getApiErrorMessage } from '../../api/client'
import type { TaskDetail, TaskPerson, TaskPriority } from '../../api/types'
import { Alert, Button } from '../../ui/chrome'
import { scheduleProblem, type TaskSchedule } from '../../lib/task-schedule'
import { MemberPicker } from './MemberPicker'
import { ScheduleFields } from './ScheduleFields'
import { PRIORITY_META, PRIORITY_ORDER, todayIso } from './task-meta'

export function TaskComposer({
  people,
  currentUserId,
  initialDate,
  onClose,
  onCreated,
}: {
  people: TaskPerson[]
  currentUserId: number | undefined
  initialDate?: string
  onClose: () => void
  onCreated: (task: TaskDetail) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [assignees, setAssignees] = useState<number[]>([])
  const [schedule, setSchedule] = useState<TaskSchedule>(() => {
    const day = initialDate ?? todayIso()
    return { repeat: 'NONE', repeatDays: null, startDate: day, endDate: null, dueDate: day }
  })
  const problem = scheduleProblem(schedule)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || problem) return
    setPending(true)
    setError('')
    try {
      const { data } = await api.post<TaskDetail>('/tasks', {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeUserIds: assignees,
        ...schedule,
      })
      onCreated(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
      setPending(false)
    }
  }

  return (
    <div className="dialog-root fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="dialog-overlay absolute inset-0 bg-[var(--overlay-bg)]"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        className="dialog-panel glass-raised tsk-composer relative z-10 w-full max-w-lg"
        onSubmit={submit}
        aria-labelledby="tsk-composer-title"
      >
        <div className="tsk-composer-head">
          <h2 id="tsk-composer-title">New ticket</h2>
          <button type="button" className="tsk-icon-btn" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="tsk-composer-body">
          {error ? <Alert>{error}</Alert> : null}
          <label className="tsk-label">
            <span>Subject</span>
            <input
              ref={titleRef}
              className="input-field"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Short summary of the request"
            />
          </label>
          <label className="tsk-label">
            <span>Description</span>
            <textarea
              className="input-field"
              rows={4}
              value={description}
              maxLength={10000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional details"
            />
          </label>
          <div className="tsk-label">
            <span>Assignees</span>
            <MemberPicker
              people={people}
              selected={people.filter((person) => assignees.includes(person.id))}
              currentUserId={currentUserId}
              onChange={setAssignees}
            />
          </div>
          <div className="tsk-label">
            <span>Schedule</span>
            <ScheduleFields value={schedule} onChange={setSchedule} />
          </div>
          <div className="tsk-label">
            <span>Priority</span>
            <div className="tsk-repeat" role="radiogroup" aria-label="Priority">
              {PRIORITY_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={priority === id}
                  className={`is-${PRIORITY_META[id].tone}${priority === id ? ' is-on' : ''}`}
                  onClick={() => setPriority(id)}
                >
                  <i aria-hidden="true" />
                  {PRIORITY_META[id].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tsk-composer-foot">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          {problem ? <span className="tsk-composer-hint">{problem}</span> : null}
          <Button type="submit" disabled={pending || !title.trim() || Boolean(problem)}>
            {pending ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </form>
    </div>
  )
}
