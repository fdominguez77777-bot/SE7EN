import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from '@/lib/navigation'
import { ClipboardCheck } from 'lucide-react'

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
import { Alert, Button, SectionCard, StatCard } from '../ui/chrome'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { formatMemberDate, ROLE_LABEL } from '../ui/roles'
import { isWeekend, toIsoDate } from '../ui/reporting-period'
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

function DiffBadge({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-sm text-[var(--text-muted)]">—</span>
  }
  if (value === 0) {
    return <StatusBadge tone="success">Matched</StatusBadge>
  }
  if (value > 0) {
    return <StatusBadge tone="warning">{`+${value}`}</StatusBadge>
  }
  return <StatusBadge tone="danger">{String(value)}</StatusBadge>
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
  const { user } = useAuth()
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
  const [openNotes, setOpenNotes] = useState<Record<number, boolean>>({})

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

  async function loadManager(nextDate = date) {
    const { data } = await api.get<DailySubmissionDetail>(
      '/daily-submissions/workspace',
      { params: { date: nextDate } },
    )
    setDetail(data)
  }

  async function loadAdmin(nextDate = date, id = selectedId) {
    const { data } = await api.get<DailySubmissionListItem[]>(
      '/daily-submissions',
      { params: { date: nextDate } },
    )
    setList(data.filter((item) => item.status !== 'DRAFT'))
    try {
      await api.post('/daily-submissions/seen')
    } catch {
      /* unread count still refreshes below */
    }
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
    setLoading(true)
    setError('')
    const run = isAdmin ? loadAdmin(date, selectedId) : loadManager(date)
    run.catch((err) => setError(getApiErrorMessage(err))).finally(() => setLoading(false))
  }, [date, isAdmin, selectedId])

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
        ? `Update the daily report for ${formatMemberDate(detail.reportingDate)}?`
        : `Submit the daily report for ${formatMemberDate(detail.reportingDate)}?`,
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
            ? 'Review daily team verification reports from Bid Managers.'
            : 'Verify each bidder, plus your own assigned profiles, before submitting the team report.'
        }
        actions={
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

      {isAdmin && !loading && selectedId == null ? (
        <AdminList
          date={date}
          items={list}
          onView={(id) => void openAdminReport(id)}
        />
      ) : null}

      {!loading && detail && (!isAdmin || selectedId != null) ? (
        <ReportWorkspace
          detail={detail}
          totals={totals}
          canEdit={Boolean(canEdit)}
          isAdmin={isAdmin}
          pending={pending}
          lockedForManager={lockedForManager}
          openNotes={openNotes}
          onToggleNotes={(id) =>
            setOpenNotes((current) => ({ ...current, [id]: !current[id] }))
          }
          onPatchRow={patchRow}
          onSave={() => void saveDraft()}
          onSubmit={requestSubmit}
          onReopen={requestReopen}
          onReview={() => void markReviewed()}
          onBack={
            isAdmin ? () => navigate('/daily-submissions') : undefined
          }
        />
      ) : null}

      {isManager && !loading && !detail ? (
        <div className="mt-5">
          <EmptyState
            title="No daily report is available for this date."
            description="Choose another reporting date, or wait until a report is started."
          />
        </div>
      ) : null}
    </section>
  )
}

function AdminList({
  date,
  items,
  onView,
}: {
  date: string
  items: DailySubmissionListItem[]
  onView: (id: number) => void
}) {
  const current = items.filter((item) => item.reportingDate.slice(0, 10) === date)
  const history = items.filter((item) => item.reportingDate.slice(0, 10) !== date)

  function ReportCard({ item }: { item: DailySubmissionListItem }) {
    return (
        <article
          className={`interactive-block rounded-xl border bg-[var(--bg-glass-solid)] px-5 py-4 ${
            item.unread
              ? 'border-[var(--accent)]/35'
              : 'border-[var(--border-glass)]'
          }`}
          role="button"
          tabIndex={0}
          onClick={() => onView(item.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onView(item.id)
            }
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                {item.manager?.name ?? 'Bid Manager'}
                {item.unread ? (
                  <span
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#141518] px-1 text-[10px] font-semibold text-white"
                    aria-label="Unread"
                  >
                    1
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {formatMemberDate(item.reportingDate)}
                {item.submittedAt
                  ? ` · Submitted ${formatTime(item.submittedAt)}`
                  : ''}
              </p>
              <div className="mt-2">
                <StatusBadge tone={statusTone(item.status)}>
                  {statusLabel(item.status)}
                </StatusBadge>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                onView(item.id)
              }}
            >
              View Report
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--text-muted)]">System apps</p>
              <p className="font-semibold">{item.systemApplications}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Gmail confirmed</p>
              <p className="font-semibold">{item.gmailConfirmed}</p>
              <DiffBadge value={item.applicationDifference} />
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">System interviews</p>
              <p className="font-semibold">{item.systemInterviews}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Verified interviews</p>
              <p className="font-semibold">{item.verifiedInterviews}</p>
              <DiffBadge value={item.interviewDifference} />
            </div>
          </div>
        </article>
    )
  }

  if (current.length === 0 && history.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState
          title="No submitted daily reports"
          description={`Bid Managers have not sent a daily report for ${formatMemberDate(date)} yet. Earlier submitted reports will appear here.`}
        />
      </div>
    )
  }

  return (
    <div className="mt-5 space-y-8">
      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
          {formatMemberDate(date)}
        </h2>
        {current.length === 0 ? (
          <EmptyState
            title="Nothing submitted for this date"
            description="A Bid Manager has not sent a report for this date yet."
          />
        ) : (
          current.map((item) => <ReportCard key={item.id} item={item} />)
        )}
      </div>
      {history.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
            Submitted history
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Earlier daily reports Bid Managers have already sent.
          </p>
          {history.map((item) => (
            <ReportCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ReportWorkspace({
  detail,
  totals,
  canEdit,
  isAdmin,
  pending,
  lockedForManager,
  openNotes,
  onToggleNotes,
  onPatchRow,
  onSave,
  onSubmit,
  onReopen,
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
  openNotes: Record<number, boolean>
  onToggleNotes: (id: number) => void
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
  onReview: () => void
  onBack?: () => void
}) {
  const { user } = useAuth()
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

      <div className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
              Today's Report
            </p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {formatMemberDate(detail.reportingDate)}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {detail.manager?.name}
              {detail.submittedAt
                ? ` · Submitted ${formatTime(detail.submittedAt)}`
                : ` · Last saved ${formatTime(detail.updated_at) ?? ''}`}
            </p>
          </div>
          <StatusBadge tone={statusTone(detail.status)}>
            {statusLabel(detail.status)}
          </StatusBadge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={detail.rows.length} label="Bidders" icon={ClipboardCheck} />
        <StatCard
          value={totals.systemApps}
          label="System application activity"
          tone="neutral"
        />
        <StatCard
          value={totals.systemInts}
          label="System interview schedules"
          tone="neutral"
        />
        <StatCard value={totals.assigned} label="Assigned candidates" tone="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={totals.gmail} label="Gmail confirmed" tone="neutral" />
        <StatCard value={totals.verified} label="Verified interviews" tone="neutral" />
        <div className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-3.5">
          <p className="text-xs text-[var(--text-muted)]">Application difference</p>
          <div className="mt-2">
            <DiffBadge value={totals.gmail - totals.systemApps} />
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-3.5">
          <p className="text-xs text-[var(--text-muted)]">Interview difference</p>
          <div className="mt-2">
            <DiffBadge value={totals.verified - totals.systemInts} />
          </div>
        </div>
      </div>

      <SectionCard
        title="Team verification"
        description="System counts are read-only. Enter Gmail confirmation and verified interview counts for every bidder and for your own assigned profiles. Admin-assigned profiles are not listed here."
      >
        {detail.rows.length === 0 ? (
          <EmptyState title="No active bidders to verify." />
        ) : (
          <div className="space-y-3">
            {detail.rows.map((row) => {
              const blank =
                row.gmailConfirmedApplicationCount == null ||
                row.verifiedInterviewCount == null
              return (
                <article
                  key={row.bidderId}
                  className={`rounded-xl border px-4 py-3.5 ${
                    blank && canEdit
                      ? 'border-[rgba(215,169,93,0.28)] bg-[rgba(215,169,93,0.1)]'
                      : 'border-[var(--border-glass)] bg-white/5'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <EntityAvatar name={row.bidderName} src={row.bidderAvatarUrl} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {row.bidderName}
                          </p>
                          {user?.id === row.bidderId ? (
                            <StatusBadge>You</StatusBadge>
                          ) : row.bidderRole && row.bidderRole !== 'BIDDER' ? (
                            <StatusBadge muted>
                              {ROLE_LABEL[row.bidderRole]}
                            </StatusBadge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{row.bidderEmail}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {row.assignedProfileCount} assigned
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
                        System
                      </p>
                      <div className="read-surface mt-2 space-y-1 px-3 py-2">
                        <p className="flex justify-between text-sm text-[var(--text-secondary)]">
                          Applications
                          <span className="num-metric text-base">{row.systemApplicationCount}</span>
                        </p>
                        <p className="flex justify-between text-sm text-[var(--text-secondary)]">
                          Interviews
                          <span className="num-metric text-base">{row.systemInterviewCount}</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
                        Verified
                      </p>
                      <label className="mt-2 block text-sm">
                        <span className="text-[var(--text-secondary)]">Gmail confirmed</span>
                        <input
                          className="input-field"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          disabled={!canEdit}
                          value={countInput(row.gmailConfirmedApplicationCount)}
                          onChange={(e) =>
                            onPatchRow(row.bidderId, {
                              gmailConfirmedApplicationCount: parseCount(
                                e.target.value,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="mt-2 block text-sm">
                        <span className="text-[var(--text-secondary)]">Verified interview schedules</span>
                        <input
                          className="input-field"
                          type="number"
                          min={0}
                          inputMode="numeric"
                          disabled={!canEdit}
                          value={countInput(row.verifiedInterviewCount)}
                          onChange={(e) =>
                            onPatchRow(row.bidderId, {
                              verifiedInterviewCount: parseCount(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)]">Application difference</span>
                    <DiffBadge value={row.applicationDifference} />
                    <span className="text-xs text-[var(--text-muted)]">Interview difference</span>
                    <DiffBadge value={row.interviewDifference} />
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-[var(--accent)]"
                    onClick={() => onToggleNotes(row.bidderId)}
                  >
                    {openNotes[row.bidderId] || row.notes ? 'Notes' : '+ Add note'}
                  </button>
                  {openNotes[row.bidderId] || row.notes ? (
                    <textarea
                      className="input-field mt-2 min-h-16"
                      maxLength={500}
                      disabled={!canEdit}
                      value={row.notes ?? ''}
                      onChange={(e) =>
                        onPatchRow(row.bidderId, { notes: e.target.value })
                      }
                      placeholder="Optional: delayed confirmations, duplicates, reschedules…"
                    />
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

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

      <p className="pt-2 text-sm text-[var(--text-muted)]">
        Weekly totals contribute to{' '}
        <Link className="font-medium text-[var(--text-primary)] underline" to="/weekly-invoices">
          Weekly Invoice
        </Link>
        .
      </p>
    </div>
  )
}
