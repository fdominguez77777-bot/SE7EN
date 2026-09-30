import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@/lib/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  DailySubmissionDetail,
  DailySubmissionListItem,
  DailySubmissionRow,
  DailySubmissionStatus,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { notifyDailySubmissionInbox } from '../layouts/daily-submission-inbox'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { isWeekend, parseLocalDate, toIsoDate } from '../ui/reporting-period'
import { StatusBadge } from '../ui/StatusBadge'

function statusLabel(status: DailySubmissionStatus) {
  if (status === 'SUBMITTED') {
    return 'Pending approval'
  }
  if (status === 'REVIEWED') {
    return 'Approved'
  }
  return 'Draft'
}

function statusTone(status: DailySubmissionStatus) {
  if (status === 'SUBMITTED') {
    return 'warning' as const
  }
  if (status === 'REVIEWED') {
    return 'success' as const
  }
  return 'info' as const
}

function formatTime(value: string | null) {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function reportingDay(item: DailySubmissionListItem) {
  return item.reportingDate.slice(0, 10)
}

function formatCount(value: number) {
  return value.toLocaleString('en-US')
}

function formatReportDay(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatReportingDateLabel(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatListDay(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function dayWindow(endIso: string, count = 14) {
  const end = parseLocalDate(endIso)
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(end)
    next.setDate(end.getDate() - (count - 1 - index))
    return toIsoDate(next)
  })
}

function shiftIso(iso: string, days: number) {
  const next = parseLocalDate(iso)
  next.setDate(next.getDate() + days)
  return toIsoDate(next)
}

function mondayOf(iso: string) {
  const date = parseLocalDate(iso.slice(0, 10))
  const day = date.getDay()
  const offset = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + offset)
  return toIsoDate(date)
}

function formatWeekHeading(monday: string) {
  const from = parseLocalDate(monday)
  const to = parseLocalDate(shiftIso(monday, 6))
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    const month = from.toLocaleDateString('en-US', { month: 'short' })
    return `${month} ${from.getDate()} – ${to.getDate()}, ${to.getFullYear()}`
  }
  const endLabel = to.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const startLabel = from.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: from.getFullYear() === to.getFullYear() ? undefined : 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

function countInput(value: number | null) {
  return value == null ? '' : String(value)
}

function parseCount(value: string): number | null {
  if (value.trim() === '') {
    return null
  }
  const next = Number(value)
  if (!Number.isInteger(next) || next < 0) {
    return null
  }
  return next
}

function parseRouteId(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    return null
  }
  return id
}

export function DailySubmissionsPage() {
  const { user, status } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const navigate = useNavigate()
  const { submissionId: submissionIdParam } = useParams<{ submissionId?: string }>()
  const selectedId = parseRouteId(submissionIdParam)
  const isAdmin = user?.role === 'ADMIN'
  const isManager = user?.role === 'BID_MANAGER'
  const [date, setDate] = useState(toIsoDate(new Date()))
  const [detail, setDetail] = useState<DailySubmissionDetail | null>(null)
  const [list, setList] = useState<DailySubmissionListItem[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const rows = detail?.rows ?? []
  const canEdit = Boolean(
    detail &&
      ((isManager && detail.status !== 'REVIEWED') ||
        (isAdmin && detail.status !== 'DRAFT')),
  )
  const lockedForManager = Boolean(isManager && detail?.status === 'REVIEWED')

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        systemApps: acc.systemApps + row.systemApplicationCount,
        gmail: acc.gmail + (row.gmailConfirmedApplicationCount ?? 0),
        systemInts: acc.systemInts + row.systemInterviewCount,
        verified: acc.verified + (row.verifiedInterviewCount ?? 0),
        assigned: acc.assigned + row.assignedProfileCount,
      }),
      { systemApps: 0, gmail: 0, systemInts: 0, verified: 0, assigned: 0 },
    )
  }, [rows])

  async function openReportForDate(nextDate: string) {
    const existing = list.find((item) => reportingDay(item) === nextDate)
    if (existing) {
      navigate(`/daily-submissions/${existing.id}`)
      return
    }
    setPending(true)
    setError('')
    try {
      const { data } = await api.get<DailySubmissionDetail>(
        '/daily-submissions/workspace',
        { params: { date: nextDate } },
      )
      navigate(`/daily-submissions/${data.id}`)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function loadAdmin(nextDate = date, id = selectedId) {
    const [{ data }] = await Promise.all([
      api.get<DailySubmissionListItem[]>('/daily-submissions', {
        params: { date: nextDate },
      }),
      api.post('/daily-submissions/seen').catch(() => null),
    ])
    setList(data.filter((item) => item.status !== 'DRAFT'))
    notifyDailySubmissionInbox()
    if (id) {
      const { data: report } = await api.get<DailySubmissionDetail>(
        `/daily-submissions/${id}`,
      )
      setDetail(report)
      notifyDailySubmissionInbox()
    } else {
      setDetail(null)
    }
  }

  useEffect(() => {
    if (status !== 'authenticated' || (!isAdmin && !isManager)) {
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const task = selectedId
      ? api
          .get<DailySubmissionDetail>(`/daily-submissions/${selectedId}`)
          .then(async ({ data }) => {
            if (cancelled) {
              return
            }
            setDetail(data)
            if (isAdmin) {
              await api.post('/daily-submissions/seen').catch(() => null)
              notifyDailySubmissionInbox()
            }
          })
      : api.get<DailySubmissionListItem[]>('/daily-submissions').then(async ({ data }) => {
          if (cancelled) {
            return
          }
          setDetail(null)
          setList(isAdmin ? data.filter((item) => item.status !== 'DRAFT') : data)
          if (isAdmin) {
            await api.post('/daily-submissions/seen').catch(() => null)
            notifyDailySubmissionInbox()
          }
        })
    task
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [status, isAdmin, isManager, selectedId])

  function patchRow(
    bidderId: number,
    patch: Partial<
      Pick<
        DailySubmissionRow,
        | 'gmailConfirmedApplicationCount'
        | 'verifiedInterviewCount'
        | 'notes'
      >
    >,
  ) {
    setDetail((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        rows: current.rows.map((row) => {
          if (row.bidderId !== bidderId) {
            return row
          }
          const next = { ...row, ...patch }
          next.applicationDifference =
            next.gmailConfirmedApplicationCount == null
              ? null
              : next.gmailConfirmedApplicationCount - next.systemApplicationCount
          next.interviewDifference =
            next.verifiedInterviewCount == null
              ? null
              : next.verifiedInterviewCount - next.systemInterviewCount
          return next
        }),
      }
    })
  }

  async function saveDraft() {
    if (!detail || !canEdit) {
      return
    }
    setError('')
    setNotice('')
    setPending(true)
    try {
      const { data } = await api.patch<DailySubmissionDetail>(
        `/daily-submissions/${detail.id}`,
        {
          rows: detail.rows.map((row) => ({
            bidderId: row.bidderId,
            gmailConfirmedApplicationCount: row.gmailConfirmedApplicationCount,
            verifiedInterviewCount: row.verifiedInterviewCount,
            notes: row.notes,
          })),
        },
      )
      setDetail(data)
      setNotice(detail.status === 'DRAFT' ? 'Draft saved.' : 'Changes saved.')
    } catch (err) {
      setError(getApiErrorMessage(err))
      throw err
    } finally {
      setPending(false)
    }
  }

  function requestSubmit() {
    if (!detail) {
      return
    }
    const incomplete = detail.rows.some(
      (row) =>
        row.gmailConfirmedApplicationCount == null ||
        row.verifiedInterviewCount == null,
    )
    if (incomplete) {
      setError('Complete the verified counts for all bidders before submitting.')
      return
    }
    const isUpdate = detail.status !== 'DRAFT'
    ask({
      title: isUpdate
        ? `Update the daily report for ${formatReportingDateLabel(detail.reportingDate)}?`
        : `Submit the daily report for ${formatReportingDateLabel(detail.reportingDate)}?`,
      description: `Gmail confirmed applications: ${totals.gmail}. Verified interview schedules: ${totals.verified}.${
        isUpdate
          ? ' You can keep editing until a manager approves this report.'
          : ' After you submit, it waits for manager approval. You can still change it until it is approved.'
      }`,
      confirmLabel: isUpdate ? 'Update Report' : 'Submit Report',
      pendingLabel: isUpdate ? 'Updating…' : 'Submitting…',
      confirmTone: 'primary',
      action: async () => {
        await saveDraft()
        try {
          const { data } = await api.post<DailySubmissionDetail>(
            `/daily-submissions/${detail.id}/submit`,
          )
          setDetail(data)
          setNotice(
            isUpdate
              ? 'Daily report updated. Still waiting for manager approval.'
              : 'Daily report submitted. Waiting for manager approval. You can still change it until it is approved.',
          )
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  function requestReopen() {
    if (!detail) {
      return
    }
    ask({
      title: 'Return this report to draft?',
      description: 'The Bid Manager will be able to edit and resubmit.',
      confirmLabel: 'Reopen report',
      pendingLabel: 'Reopening…',
      confirmTone: 'primary',
      action: async () => {
        try {
          await api.post(`/daily-submissions/${detail.id}/reopen`)
          setNotice('Report returned to draft.')
          navigate('/daily-submissions')
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  function requestDelete(id: number, label?: string) {
    ask({
      title: 'Delete this daily report?',
      description: label
        ? `Permanently remove ${label}. This cannot be undone.`
        : 'Permanently remove this daily report. This cannot be undone.',
      confirmLabel: 'Delete report',
      pendingLabel: 'Deleting…',
      confirmTone: 'danger',
      action: async () => {
        try {
          await api.delete(`/daily-submissions/${id}`)
          notifyDailySubmissionInbox()
          setNotice('Daily report deleted.')
          setDetail(null)
          navigate('/daily-submissions')
          await loadAdmin(date, null)
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  async function markReviewed() {
    if (!detail) {
      return
    }
    setPending(true)
    setError('')
    try {
      const { data } = await api.post<DailySubmissionDetail>(
        `/daily-submissions/${detail.id}/review`,
      )
      setDetail(data)
      setNotice('Daily report approved.')
      await loadAdmin(date, data.id)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function openAdminReport(id: number) {
    navigate(`/daily-submissions/${id}`)
  }

  return (
    <section>
      {dialog}
      <PageHeader
        eyebrow={isAdmin ? 'Admin' : 'Operations'}
        title="Daily Submission"
        description={
          isAdmin
            ? 'Daily reports for the week. Open one to review or approve it.'
            : 'Open a day, enter the confirmed counts, and submit.'
        }
        actions={
          <>
            <label className="text-sm text-[var(--text-secondary)]">
              Reporting date
              <input
                className="input-field mt-1"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  if (selectedId != null) {
                    navigate('/daily-submissions')
                  } else {
                    setDetail(null)
                  }
                }}
              />
            </label>
          </>
        }
      />

      {isWeekend(date) ? (
        <div className="mt-4">
          <Alert tone="info">Weekend — optional workday</Alert>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5">
          <PageSkeleton metrics={4} rows={4} />
        </div>
      ) : null}

      {(isAdmin || isManager) && !loading && selectedId == null ? (
        <AdminList
          date={date}
          items={list}
          showUnread={isAdmin}
          onDateChange={setDate}
          onView={(id) => void openAdminReport(id)}
          onStart={isManager ? (day) => void openReportForDate(day) : undefined}
          onDelete={
            isAdmin
              ? (item) =>
                  requestDelete(
                    item.id,
                    `${item.manager?.name ?? 'Bid Manager'} · ${formatReportDay(reportingDay(item))}`,
                  )
              : undefined
          }
        />
      ) : null}

      {!loading && detail && selectedId != null ? (
        <ReportWorkspace
          detail={detail}
          totals={totals}
          canEdit={Boolean(canEdit)}
          isAdmin={isAdmin}
          pending={pending}
          lockedForManager={lockedForManager}
          onPatchRow={patchRow}
          onSave={() => void saveDraft()}
          onSubmit={requestSubmit}
          onReopen={requestReopen}
          onDelete={() =>
            requestDelete(
              detail.id,
              `${detail.manager?.name ?? 'Bid Manager'} · ${formatReportDay(detail.reportingDate)}`,
            )
          }
          onReview={() => void markReviewed()}
          onBack={() => navigate('/daily-submissions')}
        />
      ) : null}
    </section>
  )
}

function AdminList({
  date,
  items,
  showUnread = true,
  onDateChange,
  onView,
  onDelete,
  onStart,
}: {
  date: string
  items: DailySubmissionListItem[]
  showUnread?: boolean
  onDateChange: (next: string) => void
  onView: (id: number) => void
  onDelete?: (item: DailySubmissionListItem) => void
  onStart?: (day: string) => void
}) {
  const todayIso = toIsoDate(new Date())
  const weekStart = mondayOf(date)
  const thisMonday = mondayOf(todayIso)
  const selectedWeekItems = items.filter(
    (item) => mondayOf(reportingDay(item)) === weekStart,
  )
  const days = useMemo(() => dayWindow(shiftIso(weekStart, 6), 7), [weekStart])
  const byDay = useMemo(() => {
    const map = new Map<string, DailySubmissionListItem[]>()
    for (const item of items) {
      const day = reportingDay(item)
      const bucket = map.get(day) ?? []
      bucket.push(item)
      map.set(day, bucket)
    }
    return map
  }, [items])

  function openRow(id: number) {
    onView(id)
  }

  function moveWeek(delta: number) {
    const next = shiftIso(date, delta * 7)
    onDateChange(next > todayIso ? todayIso : next)
  }

  function jumpToThisWeek() {
    onDateChange(todayIso)
  }

  if (items.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState
          title={showUnread ? 'No submitted daily reports' : 'No daily reports yet'}
          description={
            showUnread
              ? `Bid Managers have not sent a daily report for ${formatReportDay(date)} yet. Submitted reports will appear in this log.`
              : 'Start a report for the selected date when you are ready to verify counts. Saved drafts and submitted reports stay in this list with their status.'
          }
          action={
            onStart ? (
              <Button onClick={() => onStart(date)}>Start report</Button>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <section className="mt-5 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {formatWeekHeading(weekStart)}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {selectedWeekItems.length === 1
              ? '1 report'
              : `${selectedWeekItems.length} reports`}
          </p>
        </div>
        <div className="ds-strip-nav">
          <button
            type="button"
            className="ds-nav-btn"
            aria-label="Previous week"
            onClick={() => moveWeek(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" className="ds-nav-btn ds-nav-today" onClick={jumpToThisWeek}>
            This week
          </button>
          <button
            type="button"
            className="ds-nav-btn"
            aria-label="Next week"
            disabled={weekStart >= thisMonday}
            onClick={() => moveWeek(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {days.every((day) => (byDay.get(day) ?? []).length === 0) && !onStart ? (
        <div className="mt-4">
          <EmptyState title="No reports for this week." />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                <th className="py-2 pr-3 font-semibold">Day</th>
                {showUnread ? <th className="py-2 pr-3 font-semibold">Manager</th> : null}
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 pr-3 text-right font-semibold">Apps</th>
                <th className="py-2 pr-3 text-right font-semibold">Interviews</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dayItems = byDay.get(day) ?? []
                if (dayItems.length === 0) {
                  if (!onStart) return null
                  return (
                    <tr
                      key={day}
                      className="border-b border-[var(--border-subtle)] last:border-b-0"
                    >
                      <td className="py-3 pr-3 font-medium text-[var(--text-primary)]">
                        {formatListDay(day)}
                      </td>
                      <td className="py-3 pr-3 text-[var(--text-muted)]" colSpan={3}>
                        No report
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          className="!h-8 !px-2.5 !text-xs"
                          onClick={() => onStart(day)}
                        >
                          Start
                        </Button>
                      </td>
                    </tr>
                  )
                }
                return dayItems.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-white/[0.03]"
                    onClick={() => openRow(item.id)}
                  >
                    <td className="py-3 pr-3 font-medium text-[var(--text-primary)]">
                      {formatListDay(reportingDay(item))}
                    </td>
                    {showUnread ? (
                      <td className="py-3 pr-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <EntityAvatar
                            name={item.manager?.name ?? 'Bid Manager'}
                            src={item.manager?.avatarUrl}
                            size="sm"
                          />
                          <span className="truncate text-[var(--text-primary)]">
                            {item.manager?.name ?? 'Bid Manager'}
                            {item.unread ? <span className="ds-new">New</span> : null}
                          </span>
                        </div>
                      </td>
                    ) : null}
                    <td className="py-3 pr-3">
                      <StatusBadge tone={statusTone(item.status)}>
                        {statusLabel(item.status)}
                      </StatusBadge>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[var(--text-primary)]">
                      {formatCount(item.gmailConfirmed)}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-[var(--text-primary)]">
                      {formatCount(item.verifiedInterviews)}
                    </td>
                    <td
                      className="py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        className="!h-8 !px-2.5 !text-xs"
                        onClick={() => openRow(item.id)}
                      >
                        Open
                      </Button>
                      {onDelete ? (
                        <Button
                          variant="danger"
                          className="!ml-1 !h-8 !px-2.5 !text-xs"
                          onClick={() => onDelete(item)}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ReportWorkspace({
  detail,
  totals,
  canEdit,
  isAdmin,
  pending,
  lockedForManager,
  onPatchRow,
  onSave,
  onSubmit,
  onReopen,
  onDelete,
  onReview,
  onBack,
}: {
  detail: DailySubmissionDetail
  totals: {
    systemApps: number
    gmail: number
    systemInts: number
    verified: number
    assigned: number
  }
  canEdit: boolean
  isAdmin: boolean
  pending: boolean
  lockedForManager: boolean
  onPatchRow: (
    bidderId: number,
    patch: Partial<
      Pick<
        DailySubmissionRow,
        'gmailConfirmedApplicationCount' | 'verifiedInterviewCount' | 'notes'
      >
    >,
  ) => void
  onSave: () => void
  onSubmit: () => void
  onReopen: () => void
  onDelete: () => void
  onReview: () => void
  onBack?: () => void
}) {
  const incomplete = detail.rows.filter(
    (row) =>
      row.gmailConfirmedApplicationCount == null ||
      row.verifiedInterviewCount == null,
  )
  return (
    <div className="mt-5 space-y-4 pb-28">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          ← All submissions
        </Button>
      ) : null}

      <section className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {formatReportDay(detail.reportingDate)}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {detail.manager?.name}
              {detail.submittedAt
                ? ` · Submitted ${formatTime(detail.submittedAt)}`
                : ''}
            </p>
          </div>
          <StatusBadge tone={statusTone(detail.status)}>
            {statusLabel(detail.status)}
          </StatusBadge>
        </div>

        {detail.rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No active bidders to verify." />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                  <th className="py-2 pr-3 font-semibold">Bidder</th>
                  <th className="py-2 pr-3 font-semibold">Gmail confirmed</th>
                  <th className="py-2 font-semibold">Verified interviews</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr
                    key={row.bidderId}
                    className="border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar
                          name={row.bidderName}
                          src={row.bidderAvatarUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">
                            {row.bidderName}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            System {row.systemApplicationCount.toLocaleString()} apps ·{' '}
                            {row.systemInterviewCount.toLocaleString()} interviews
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        className="input-field max-w-[8rem]"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Gmail confirmed for ${row.bidderName}`}
                        disabled={!canEdit}
                        value={countInput(row.gmailConfirmedApplicationCount)}
                        onChange={(event) =>
                          onPatchRow(row.bidderId, {
                            gmailConfirmedApplicationCount: parseCount(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="py-3">
                      <input
                        className="input-field max-w-[8rem]"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`Verified interviews for ${row.bidderName}`}
                        disabled={!canEdit}
                        value={countInput(row.verifiedInterviewCount)}
                        onChange={(event) =>
                          onPatchRow(row.bidderId, {
                            verifiedInterviewCount: parseCount(event.target.value),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-glass)] bg-[var(--bg-glass-solid)]/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">{totals.gmail}</span> Gmail
              confirmed ·{' '}
              <span className="font-medium text-[var(--text-primary)]">{totals.verified}</span>{' '}
              verified interviews
              {incomplete.length > 0
                ? ` · ${incomplete.length} bidder${incomplete.length === 1 ? '' : 's'} incomplete`
                : ''}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={pending} onClick={onSave}>
                {pending
                  ? 'Saving…'
                  : isAdmin
                    ? 'Save changes'
                    : detail.status === 'DRAFT'
                      ? 'Save Draft'
                      : 'Save'}
              </Button>
              {!isAdmin ? (
                <Button disabled={pending} onClick={onSubmit}>
                  {detail.status === 'DRAFT'
                    ? 'Submit Daily Report'
                    : 'Update submitted report'}
                </Button>
              ) : null}
              {isAdmin && detail.status === 'SUBMITTED' ? (
                <Button disabled={pending} onClick={onReview}>
                  Approve
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin && detail.status !== 'DRAFT' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onReopen}>
            Return to Draft
          </Button>
          <Button variant="danger" disabled={pending} onClick={onDelete}>
            Delete report
          </Button>
        </div>
      ) : isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={pending} onClick={onDelete}>
            Delete report
          </Button>
        </div>
      ) : null}

      {lockedForManager ? (
        <Alert tone="info">
          This daily report is approved. Only a manager can change it.
        </Alert>
      ) : !isAdmin && detail.status === 'SUBMITTED' ? (
        <Alert tone="info">
          Waiting for manager approval. You can still change this report until it
          is approved.
        </Alert>
      ) : null}
    </div>
  )
}
