import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarCheck, CheckCircle2, RotateCcw, Trash2, X } from 'lucide-react'

import { api, getApiErrorMessage } from '../../api/client'
import type { TaskActivityEntry, TaskDetail, TaskPerson, TaskPriority, TaskStatus } from '../../api/types'
import { Alert, Button, Skeleton } from '../../ui/chrome'
import { splitLinkedText } from '../../ui/text-links'
import { describeSchedule, occursOn, scheduleProblem, type TaskSchedule } from '../../lib/task-schedule'
import { MemberPicker } from './MemberPicker'
import { ScheduleFields } from './ScheduleFields'
import { PersonAvatar } from './task-bits'
import {
  describeActivity,
  PRIORITY_META,
  PRIORITY_ORDER,
  relativeTime,
  STATUS_META,
  todayIso,
} from './task-meta'

type Patch = Partial<{
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigneeUserIds: number[]
}> &
  Partial<TaskSchedule>

type Ask = (request: {
  title: string
  description: string
  confirmLabel?: string
  action: () => Promise<void>
}) => void

type Draft = {
  title: string
  description: string
  priority: TaskPriority
  assigneeIds: number[]
  schedule: TaskSchedule
}

function scheduleOf(task: TaskDetail): TaskSchedule {
  return {
    repeat: task.repeat,
    repeatDays: task.repeatDays,
    startDate: task.startDate,
    endDate: task.endDate,
    dueDate: task.dueDate,
  }
}

function draftFrom(task: TaskDetail): Draft {
  return {
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    assigneeIds: task.assignees.map((person) => person.id),
    schedule: scheduleOf(task),
  }
}

function pendingChanges(task: TaskDetail, draft: Draft): Patch {
  const changes: Patch = {}
  const title = draft.title.trim()
  if (title && title !== task.title) changes.title = title
  const description = draft.description.trim()
  if (description !== (task.description ?? '')) changes.description = description || null
  if (draft.priority !== task.priority) changes.priority = draft.priority
  const before = task.assignees.map((person) => person.id).sort((a, b) => a - b)
  const after = [...draft.assigneeIds].sort((a, b) => a - b)
  if (before.join(',') !== after.join(',')) changes.assigneeUserIds = draft.assigneeIds
  const current = scheduleOf(task)
  const keys = Object.keys(current) as (keyof TaskSchedule)[]
  if (keys.some((key) => current[key] !== draft.schedule[key])) Object.assign(changes, draft.schedule)
  return changes
}

function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitLinkedText(text).map((part, index) =>
        part.href ? (
          <a key={`${part.href}-${index}`} href={part.href} target="_blank" rel="noreferrer">
            {part.text}
          </a>
        ) : (
          part.text
        ),
      )}
    </>
  )
}

export function TaskModal({
  taskId,
  people,
  currentUserId,
  isAdmin,
  ask,
  onClose,
  onChanged,
  onDeleted,
}: {
  taskId: number
  people: TaskPerson[]
  currentUserId: number | undefined
  isAdmin: boolean
  ask: Ask
  onClose: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [comment, setComment] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<TaskDetail>(`/tasks/${taskId}`, { skipGetCache: true } as object)
      .then(({ data }) => {
        if (cancelled) return
        setDetail(data)
        setDraft(draftFrom(data))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getApiErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  /** Comments save on their own, so they must not wipe unsaved edits. */
  function accept(data: TaskDetail, resetDraft = true) {
    setDetail(data)
    if (resetDraft) setDraft(draftFrom(data))
    onChanged()
  }

  const changes = detail && draft ? pendingChanges(detail, draft) : {}
  const dirty = Object.keys(changes).length > 0
  const problem = !draft
    ? null
    : !draft.title.trim()
      ? 'Give the task a subject.'
      : scheduleProblem(draft.schedule)

  function update(next: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...next } : prev))
  }

  async function save(extra: Patch = {}) {
    if (problem) return false
    const body = { ...changes, ...extra }
    if (Object.keys(body).length === 0) return true
    setSaving(true)
    setError('')
    try {
      const { data } = await api.patch<TaskDetail>(`/tasks/${taskId}`, body)
      accept(data)
      return true
    } catch (err) {
      setError(getApiErrorMessage(err))
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Completed tasks leave the timeline, so the modal goes with them. */
  async function completeTask() {
    if (await save({ status: 'DONE' })) onClose()
  }

  const today = todayIso()
  const myCompletion = detail?.completions.find(
    (row) => row.userId === currentUserId && (detail.repeat === 'NONE' || row.date === today),
  )
  const scheduledToday = detail ? detail.repeat === 'NONE' || occursOn(detail, today) : false
  const doneTodayIds = new Set(
    (detail?.completions ?? [])
      .filter((row) => detail?.repeat === 'NONE' || row.date === today)
      .map((row) => row.userId),
  )
  const doneToday = (detail?.assignees ?? []).filter((person) => doneTodayIds.has(person.id))

  async function toggleDaily() {
    if (!detail) return
    if (dirty && !(await save())) return
    setSaving(true)
    setError('')
    try {
      const { data } = await api.post<TaskDetail>(`/tasks/${taskId}/occurrences`, {
        date: myCompletion?.date ?? today,
        done: !myCompletion,
      })
      accept(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function requestClose() {
    if (!dirty) {
      onClose()
      return
    }
    ask({
      title: 'Discard unsaved changes?',
      description: 'Your edits to this ticket have not been saved.',
      confirmLabel: 'Discard',
      action: async () => onClose(),
    })
  }

  const requestCloseRef = useRef(requestClose)
  useEffect(() => {
    requestCloseRef.current = requestClose
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const target = event.target as HTMLElement | null
      if (target?.closest('.tsk-pop') || document.querySelector('.dialog-root')) return
      event.stopPropagation()
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        target.blur()
        return
      }
      requestCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  async function postComment(event: FormEvent) {
    event.preventDefault()
    const body = comment.trim()
    if (!body) return
    setPosting(true)
    setError('')
    try {
      const { data } = await api.post<TaskDetail>(`/tasks/${taskId}/comments`, { body })
      setComment('')
      accept(data, false)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPosting(false)
    }
  }

  function removeComment(entry: TaskActivityEntry) {
    ask({
      title: 'Delete comment?',
      description: 'This comment will be removed.',
      action: async () => {
        try {
          const { data } = await api.delete<TaskDetail>(`/tasks/${taskId}/comments/${entry.id}`)
          accept(data, false)
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  function removeTask() {
    if (!detail) return
    ask({
      title: `Delete ${detail.key}?`,
      description: `"${detail.title}", its comments and everyone's daily completions will be permanently deleted.`,
      confirmLabel: 'Delete task',
      action: async () => {
        try {
          await api.delete(`/tasks/${taskId}`)
          onDeleted()
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  const canEdit = detail?.permissions.canEdit ?? false
  const disabled = !canEdit || saving
  const selected = draft
    ? draft.assigneeIds.flatMap(
        (id) => people.find((person) => person.id === id) ?? detail?.assignees.find((person) => person.id === id) ?? [],
      )
    : []
  const panel = (
    <div className="tsk-modal-root">
      <button type="button" className="tsk-modal-overlay" aria-label="Close ticket" onClick={requestClose} />
      <div className="tsk-modal" role="dialog" aria-modal="true" aria-label={detail?.title ?? 'Ticket'}>
        <header className="tsk-modal-head">
          <span className="tsk-key">{detail?.key ?? ''}</span>
          {detail ? (
            <span className={`tkt-status is-${STATUS_META[detail.status].tone}`}>
              <i aria-hidden="true" />
              {STATUS_META[detail.status].label}
            </span>
          ) : null}
          {saving ? <span className="tsk-saving">Saving…</span> : null}
          <span className="ml-auto flex items-center gap-1">
            {detail?.permissions.canDelete ? (
              <button type="button" className="tsk-icon-btn is-danger" onClick={removeTask} aria-label="Delete task" title="Delete task">
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button type="button" className="tsk-icon-btn" onClick={requestClose} aria-label="Close" title="Close">
              <X className="h-4 w-4" />
            </button>
          </span>
        </header>

        {loadError ? (
          <div className="p-6">
            <Alert>{loadError}</Alert>
          </div>
        ) : !detail || !draft ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="tsk-modal-body">
            <div className="tsk-modal-main">
              <div className="tsk-modal-scroll">
                {error ? <Alert>{error}</Alert> : null}
                <textarea
                  className="tsk-drawer-title"
                  value={draft.title}
                  rows={1}
                  maxLength={200}
                  disabled={!canEdit}
                  onChange={(event) => update({ title: event.target.value.replace(/\n/g, ' ') })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                  aria-label="Subject"
                />

                <section className="tsk-section">
                  <h3>Description</h3>
                  {canEdit ? (
                    <textarea
                      className="input-field tsk-desc-input"
                      rows={5}
                      value={draft.description}
                      maxLength={10000}
                      placeholder="Add a description…"
                      onChange={(event) => update({ description: event.target.value })}
                    />
                  ) : detail.description ? (
                    <p className="tsk-text">
                      <LinkedText text={detail.description} />
                    </p>
                  ) : (
                    <p className="tsk-text tsk-muted">No description.</p>
                  )}
                </section>

                <section className="tsk-section">
                  <h3>
                    Activity
                    {detail.commentCount > 0 ? <span className="tsk-section-count">{detail.commentCount}</span> : null}
                  </h3>
                  <ol className="tsk-feed">
                    {detail.activity.map((entry) =>
                      entry.kind === 'COMMENT' ? (
                        <li key={entry.id} className="tsk-comment">
                          <PersonAvatar person={entry.actor} />
                          <div className="tsk-comment-card">
                            <div className="tsk-comment-head">
                              <strong>{entry.actor?.name ?? 'Former member'}</strong>
                              <time dateTime={entry.created_at} title={new Date(entry.created_at).toLocaleString()}>
                                {relativeTime(entry.created_at)}
                              </time>
                              {entry.actor?.id === currentUserId || isAdmin ? (
                                <button
                                  type="button"
                                  className="tsk-comment-delete"
                                  onClick={() => removeComment(entry)}
                                  aria-label="Delete comment"
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                            <p className="tsk-text">
                              <LinkedText text={entry.body ?? ''} />
                            </p>
                          </div>
                        </li>
                      ) : (
                        <li key={entry.id} className="tsk-event">
                          <span>
                            <strong>{entry.actor?.name ?? 'Someone'}</strong> {describeActivity(entry)}
                          </span>
                          <time dateTime={entry.created_at} title={new Date(entry.created_at).toLocaleString()}>
                            {relativeTime(entry.created_at)}
                          </time>
                        </li>
                      ),
                    )}
                  </ol>
                </section>
              </div>

              <form className="tsk-reply" onSubmit={postComment}>
                <input
                  className="input-field"
                  value={comment}
                  maxLength={5000}
                  placeholder="Write a comment…"
                  onChange={(event) => setComment(event.target.value)}
                  aria-label="Comment"
                />
                <Button type="submit" disabled={posting || !comment.trim()}>
                  Send
                </Button>
              </form>
            </div>

            <aside className="tsk-modal-side" aria-label="Ticket details">
              <h3>Details</h3>
              {!canEdit ? (
                <dl className="tsk-side-meta tsk-side-readonly">
                  <div>
                    <dt>Assignees</dt>
                    <dd className="tsk-side-people">
                      {detail.assignees.length === 0
                        ? 'Unassigned'
                        : detail.assignees.map((person) => (
                            <span key={person.id}>
                              <PersonAvatar person={person} done={doneTodayIds.has(person.id)} />
                              {person.name}
                            </span>
                          ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Priority</dt>
                    <dd>
                      <span className={`tl-prio-dot is-${PRIORITY_META[detail.priority].tone}`} aria-hidden="true" />
                      {PRIORITY_META[detail.priority].label}
                    </dd>
                  </div>
                  <div>
                    <dt>Schedule</dt>
                    <dd>{describeSchedule(detail)}</dd>
                  </div>
                </dl>
              ) : null}
              <dl className="tsk-side-fields" hidden={!canEdit}>
                <div>
                  <dt>Assignees</dt>
                  <dd>
                    <MemberPicker
                      people={people}
                      selected={selected}
                      currentUserId={currentUserId}
                      disabled={disabled}
                      onChange={(ids) => update({ assigneeIds: ids })}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>
                    <select
                      className="input-field tsk-side-input"
                      value={draft.priority}
                      disabled={disabled}
                      onChange={(event) => update({ priority: event.target.value as TaskPriority })}
                    >
                      {PRIORITY_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {PRIORITY_META[id].label}
                        </option>
                      ))}
                    </select>
                  </dd>
                </div>
                <div>
                  <dt>
                    Schedule
                    <span className="tsk-side-hint">{describeSchedule(draft.schedule)}</span>
                  </dt>
                  <dd>
                    <ScheduleFields
                      compact
                      value={draft.schedule}
                      disabled={disabled}
                      onChange={(schedule) => update({ schedule })}
                    />
                  </dd>
                </div>
              </dl>
              <dl className="tsk-side-meta">
                <div>
                  <dt>Reporter</dt>
                  <dd>
                    <PersonAvatar person={detail.reporter} />
                    {detail.reporter?.name ?? 'Former member'}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd title={new Date(detail.created_at).toLocaleString()}>
                    {new Date(detail.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd title={new Date(detail.updated_at).toLocaleString()}>{relativeTime(detail.updated_at)}</dd>
                </div>
              </dl>

              {canEdit || detail.permissions.canCompleteDaily ? (
                <div className="tsk-side-actions">
                  {canEdit ? (
                    <p className={problem && dirty ? 'is-error' : dirty ? 'is-dirty' : ''} aria-live="polite">
                      {problem && dirty ? problem : dirty ? 'You have unsaved changes' : 'All changes saved'}
                    </p>
                  ) : null}
                  {detail.permissions.canCompleteDaily && detail.status !== 'DONE' ? (
                    <button
                      type="button"
                      className={`tsk-complete${myCompletion ? ' is-reopen' : ''}${detail.permissions.canComplete ? ' is-secondary' : ''}`}
                      disabled={saving || Boolean(problem) || (!myCompletion && !scheduledToday)}
                      onClick={() => void toggleDaily()}
                      title={!scheduledToday ? 'This task is not scheduled for today' : undefined}
                    >
                      {myCompletion ? (
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                      {myCompletion
                        ? 'Undo daily task'
                        : !scheduledToday
                          ? 'Not scheduled today'
                          : dirty
                            ? 'Save & complete daily task'
                            : 'Complete daily task'}
                    </button>
                  ) : null}
                  {!detail.permissions.canComplete ? null : detail.status === 'DONE' ? (
                    <button
                      type="button"
                      className="tsk-complete is-reopen"
                      disabled={saving || Boolean(problem)}
                      onClick={() => void save({ status: 'TODO' })}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      {dirty ? 'Save & reopen' : 'Reopen'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tsk-complete"
                      disabled={saving || Boolean(problem)}
                      onClick={() => void completeTask()}
                      title={detail.repeat === 'NONE' ? 'Close this task for everyone' : 'Close the whole recurring task for everyone'}
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {dirty ? 'Save & complete' : 'Complete'}
                    </button>
                  )}
                  {detail.assignees.length > 0 ? (
                    <p className="tsk-side-progress">
                      {detail.repeat === 'NONE' ? 'Done' : 'Done today'}:{' '}
                      {doneToday.length === 0
                        ? 'nobody yet'
                        : `${doneToday.map((person) => person.name).join(', ')} (${doneToday.length}/${detail.assignees.length})`}
                    </p>
                  ) : null}
                  {canEdit ? (
                    <div className="tsk-side-actions-row">
                      <Button
                        variant="ghost"
                        disabled={!dirty || saving}
                        onClick={() => setDraft(draftFrom(detail))}
                      >
                        Discard
                      </Button>
                      <Button disabled={!dirty || saving || Boolean(problem)} onClick={() => void save()}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </Button>
                    </div>
                  ) : null}
                  {detail.permissions.canDelete ? (
                    <button type="button" className="tsk-delete" disabled={saving} onClick={removeTask}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete task
                    </button>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </div>
  )

  return typeof document === 'undefined' ? null : createPortal(panel, document.body)
}