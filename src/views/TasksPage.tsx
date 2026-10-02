'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { TaskItem, TaskList, TaskPerson } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { addDays, mondayOf, shortDate } from '../lib/task-schedule'
import { Alert, Button } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { PageHeader } from '../ui/page-header'
import { TaskComposer } from './tasks/TaskComposer'
import { TaskModal } from './tasks/TaskModal'
import { TaskTimeline } from './tasks/TaskTimeline'
import { todayIso } from './tasks/task-meta'
import { buildTimeline, type TimelineEntry } from './tasks/task-timeline'

type Scope = 'mine' | 'reported' | 'all'

const REFRESH_MS = 30_000

const EMPTY: TaskList = {
  summary: { open: 0, inProgress: 0, overdue: 0, doneThisWeek: 0, assignedToMe: 0 },
  tasks: [],
}

function taskFromUrl() {
  if (typeof window === 'undefined') return null
  const value = Number(new URLSearchParams(window.location.search).get('task'))
  return Number.isInteger(value) && value > 0 ? value : null
}

function syncTaskUrl(id: number | null) {
  const url = new URL(window.location.href)
  if (id) {
    url.searchParams.set('task', String(id))
  } else {
    url.searchParams.delete('task')
  }
  window.history.replaceState(window.history.state, '', url)
}

function markDone(task: TaskItem, entry: TimelineEntry, done: boolean): TaskItem {
  if (task.repeat === 'NONE' || (!done && task.status === 'DONE')) {
    return { ...task, status: done ? 'DONE' : 'TODO', completedAt: done ? new Date().toISOString() : null }
  }
  return {
    ...task,
    completedOn: done
      ? [...task.completedOn, entry.date]
      : task.completedOn.filter((date) => date !== entry.date),
  }
}

export function TasksPage() {
  const { user } = useAuth()
  const [scope, setScope] = useState<Scope>('all')
  const [monday, setMonday] = useState(() => mondayOf(todayIso()))
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [data, setData] = useState<TaskList>(EMPTY)
  const [people, setPeople] = useState<TaskPerson[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [composer, setComposer] = useState<{ date?: string } | null>(null)
  const [openId, setOpenId] = useState<number | null>(taskFromUrl)
  const { ask, dialog } = useConfirmDialog()

  const today = todayIso()
  const thisMonday = mondayOf(today)

  const params = useMemo(
    () => ({ scope, search: appliedSearch || undefined, from: monday, to: addDays(monday, 6) }),
    [scope, appliedSearch, monday],
  )

  useEffect(() => {
    let cancelled = false
    api
      .get<TaskList>('/tasks', { params, skipGetCache: true } as object)
      .then(({ data: next }) => {
        if (cancelled) return
        setData(next)
        setError('')
        setLoaded(true)
      })
      .catch((err) => {
        if (cancelled) return
        setError(getApiErrorMessage(err))
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [params, reloadNonce])

  useEffect(() => {
    let cancelled = false
    api
      .get<TaskPerson[]>('/tasks/people')
      .then(({ data: rows }) => {
        if (!cancelled) setPeople(rows)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setReloadNonce((value) => value + 1)
      }
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const handle = window.setTimeout(() => setAppliedSearch(search.trim()), 250)
    return () => window.clearTimeout(handle)
  }, [search])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const target = event.target as HTMLElement | null
      if (composer) {
        setComposer(null)
      } else if (openId !== null) {
        if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          target.blur()
          return
        }
        setOpenId(null)
        syncTaskUrl(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composer, openId])

  function refresh() {
    setReloadNonce((value) => value + 1)
  }

  function openTask(id: number | null) {
    setOpenId(id)
    syncTaskUrl(id)
  }

  async function toggle(entry: TimelineEntry) {
    const done = !entry.done
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => (task.id === entry.task.id ? markDone(task, entry, done) : task)),
    }))
    try {
      if (!done && entry.task.repeat !== 'NONE' && entry.task.status === 'DONE') {
        await api.patch(`/tasks/${entry.task.id}`, { status: 'TODO' })
      } else {
        await api.post(`/tasks/${entry.task.id}/occurrences`, { date: entry.date, done })
      }
      setError('')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      refresh()
    }
  }

  const days = useMemo(() => buildTimeline(data.tasks, monday, today, user?.id), [data.tasks, monday, today, user?.id])

  const week = useMemo(() => {
    let total = 0
    let done = 0
    let overdue = 0
    for (const day of days) {
      total += day.entries.length
      done += day.done
      overdue += day.entries.filter((entry) => entry.note?.tone === 'overdue').length
    }
    return { total, done, overdue, progress: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [days])

  if (!loaded) {
    return <PageSkeleton />
  }

  const friday = addDays(monday, 4)
  const weekLabel = `${shortDate(monday)} – ${shortDate(friday)}, ${friday.slice(0, 4)}`

  return (
    <section className="tsk-page page-enter">
      <PageHeader
        title="Tasks"
        description="Plan the work week, assign tasks to teammates and tick them off day by day."
        actions={
          <Button onClick={() => setComposer({})}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="tl-toolbar">
        <div className="tl-week">
          <button type="button" className="tsk-icon-btn" onClick={() => setMonday(addDays(monday, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="tl-week-label">
            <strong>{weekLabel}</strong>
            <span>
              {monday === thisMonday ? 'This week' : monday < thisMonday ? 'Past week' : 'Upcoming week'}
            </span>
          </div>
          <button type="button" className="tsk-icon-btn" onClick={() => setMonday(addDays(monday, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </button>
          {monday !== thisMonday ? (
            <button type="button" className="tl-today-btn" onClick={() => setMonday(thisMonday)}>
              Today
            </button>
          ) : null}
        </div>

        <div className="tl-stats" aria-label="Week progress">
          <div className="tl-stats-ring" style={{ ['--p' as string]: `${week.progress}%` }}>
            <span>{week.progress}%</span>
          </div>
          <div className="tl-stats-text">
            <strong>
              {week.done} of {week.total} done
            </strong>
            <span className={week.overdue > 0 ? 'is-overdue' : ''}>
              {week.overdue > 0 ? `${week.overdue} overdue` : 'Nothing overdue'}
            </span>
          </div>
        </div>

        <div className="tkt-filters">
          <select
            className="input-field tkt-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as Scope)}
            aria-label="Show"
          >
            <option value="mine">Assigned to me</option>
            <option value="reported">Created by me</option>
            <option value="all">All my tasks</option>
          </select>
          <label className="tsk-search">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input
              className="input-field"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
          </label>
        </div>
      </div>

      <TaskTimeline days={days} onOpen={openTask} onToggle={(entry) => void toggle(entry)} onAdd={(date) => setComposer({ date })} />

      {composer ? (
        <TaskComposer
          people={people}
          currentUserId={user?.id}
          initialDate={composer.date}
          onClose={() => setComposer(null)}
          onCreated={(task) => {
            setComposer(null)
            const first = task.repeat === 'NONE' ? task.dueDate : task.startDate
            if (first) {
              setMonday(first < today ? thisMonday : mondayOf(first))
            }
            refresh()
          }}
        />
      ) : null}

      {openId !== null ? (
        <TaskModal
          key={openId}
          taskId={openId}
          people={people}
          currentUserId={user?.id}
          isAdmin={user?.role === 'ADMIN'}
          ask={ask}
          onClose={() => openTask(null)}
          onChanged={refresh}
          onDeleted={() => {
            openTask(null)
            refresh()
          }}
        />
      ) : null}
      {dialog}
    </section>
  )
}
