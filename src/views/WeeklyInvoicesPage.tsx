import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@/lib/navigation'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Receipt,
} from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  PublishedWeeklyInvoice,
  WeeklyInvoiceDetail,
  WeeklyInvoiceListItem,
  WeeklyInvoiceStatus,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { formatRate, formatUsd, isPositiveUsd } from '../ui/money'
import { PageHeader } from '../ui/page-header'
import {
  formatRangeLabel,
  isStandardWorkday,
  isWeekend,
  parseLocalDate,
  toIsoDate,
  weekRange,
} from '../ui/reporting-period'
import { StatusBadge } from '../ui/StatusBadge'

type AdminListFilter = 'all' | 'week' | 'pending' | 'approved'

function statusLabel(status: WeeklyInvoiceStatus) {
  if (status === 'SUBMITTED' || status === 'REVIEWED') return 'Pending approval'
  if (status === 'APPROVED') return 'Approved'
  return 'Draft'
}

function statusTone(status: WeeklyInvoiceStatus) {
  if (status === 'APPROVED') return 'success' as const
  if (status === 'SUBMITTED' || status === 'REVIEWED') return 'warning' as const
  return 'info' as const
}

function formatTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDay(iso: string) {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function currentMondayIso() {
  return toIsoDate(weekRange('current').from)
}

function weekWindow(endMonday: string, count = 8) {
  const end = parseLocalDate(endMonday)
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(end)
    next.setDate(end.getDate() - (count - 1 - index) * 7)
    return toIsoDate(next)
  })
}

function shiftMonday(monday: string, weeks: number) {
  const next = parseLocalDate(monday)
  next.setDate(next.getDate() + weeks * 7)
  return toIsoDate(next)
}

function formatWeekSpan(monday: string) {
  const from = parseLocalDate(monday)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  if (from.getMonth() === to.getMonth()) {
    return `${from.toLocaleDateString('en-US', { month: 'short' })} ${from.getDate()}–${to.getDate()}`
  }
  return `${from.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}–${to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function isPendingInvoice(status: WeeklyInvoiceStatus) {
  return status === 'SUBMITTED' || status === 'REVIEWED'
}

function invoiceWeekKey(item: WeeklyInvoiceListItem) {
  return item.periodStart.slice(0, 10)
}

function groupByWeek(items: WeeklyInvoiceListItem[]) {
  const groups: { start: string; end: string; items: WeeklyInvoiceListItem[] }[] = []
  const index = new Map<string, WeeklyInvoiceListItem[]>()
  for (const item of items) {
    const start = invoiceWeekKey(item)
    let bucket = index.get(start)
    if (!bucket) {
      bucket = []
      index.set(start, bucket)
      groups.push({ start, end: item.periodEnd.slice(0, 10), items: bucket })
    }
    bucket.push(item)
  }
  return groups
}

function sumUsd(items: WeeklyInvoiceListItem[]) {
  return items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0)
}

function withFormattedRates(data: WeeklyInvoiceDetail): WeeklyInvoiceDetail {
  return {
    ...data,
    rows: data.rows.map((row) => ({
      ...row,
      invoiceApplicationRate: formatRate(row.invoiceApplicationRate),
      invoiceInterviewRate: formatRate(row.invoiceInterviewRate),
    })),
  }
}

function parseRouteId(value: string | undefined): number | null {
  if (!value) return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

export function WeeklyInvoicesPage() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const navigate = useNavigate()
  const { invoiceId: invoiceIdParam } = useParams<{ invoiceId?: string }>()
  const selectedId = parseRouteId(invoiceIdParam)
  const isAdmin = user?.role === 'ADMIN'
  const isManager = user?.role === 'BID_MANAGER'
  const [preset, setPreset] = useState<'current' | 'previous'>('current')
  const week = weekRange(preset)
  const weekStart = toIsoDate(week.from)
  const thisMonday = currentMondayIso()
  const [focusWeek, setFocusWeek] = useState(thisMonday)
  const [detail, setDetail] = useState<WeeklyInvoiceDetail | null>(null)
  const [list, setList] = useState<WeeklyInvoiceListItem[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const canEdit = Boolean(
    detail &&
      ((isManager && detail.status !== 'APPROVED') ||
        (isAdmin && detail.status !== 'DRAFT')),
  )
  const lockedForManager = Boolean(isManager && detail?.status === 'APPROVED')

  const totals = useMemo(() => {
    const rows = detail?.rows ?? []
    const apps = rows.reduce((sum, row) => sum + row.defaultApplicationCount, 0)
    const interviews = rows.reduce((sum, row) => sum + row.defaultInterviewCount, 0)
    const applicationAmount = rows.reduce(
      (sum, row) =>
        sum + row.defaultApplicationCount * (Number(row.configuredApplicationRate) || 0),
      0,
    )
    const interviewAmount = rows.reduce(
      (sum, row) =>
        sum + row.defaultInterviewCount * (Number(row.configuredInterviewRate) || 0),
      0,
    )
    return {
      apps,
      interviews,
      applicationAmount: applicationAmount.toFixed(2),
      interviewAmount: interviewAmount.toFixed(2),
      total: (applicationAmount + interviewAmount).toFixed(2),
    }
  }, [detail])

  async function loadManager(nextWeek = weekStart) {
    const { data } = await api.get<WeeklyInvoiceDetail>(
      '/weekly-invoices/workspace',
      { params: { weekStart: nextWeek } },
    )
    setDetail(withFormattedRates(data))
  }

  async function loadAdmin(nextWeek = weekStart, id = selectedId) {
    const { data } = await api.get<WeeklyInvoiceListItem[]>(
      '/weekly-invoices',
      { params: { weekStart: nextWeek } },
    )
    setList(data.filter((item) => item.status !== 'DRAFT'))
    if (id) {
      const { data: invoice } = await api.get<WeeklyInvoiceDetail>(
        `/weekly-invoices/${id}`,
      )
      setDetail(withFormattedRates(invoice))
    } else {
      setDetail(null)
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    loadAdmin(weekStart, selectedId)
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
  }, [isAdmin, selectedId])

  useEffect(() => {
    if (isAdmin) {
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    loadManager(weekStart)
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
  }, [isAdmin, weekStart])

  function payload() {
    if (!detail) return { rows: [] }
    return {
      managerNotes: detail.managerNotes,
      noActivityDates: detail.noActivityDates,
      missingDayAcknowledgement: detail.missingDayAcknowledgement,
      rows: detail.rows.map((row) => ({
        bidderId: row.bidderId,
        invoiceApplicationCount: row.defaultApplicationCount,
        invoiceInterviewCount: row.defaultInterviewCount,
        invoiceApplicationRate: row.configuredApplicationRate,
        invoiceInterviewRate: row.configuredInterviewRate,
        countAdjustmentReason: null,
        rateAdjustmentReason: null,
      })),
    }
  }

  async function saveDraft() {
    if (!detail || !canEdit) return
    setError('')
    setNotice('')
    setPending(true)
    try {
      const { data } = await api.patch<WeeklyInvoiceDetail>(
        `/weekly-invoices/${detail.id}`,
        payload(),
      )
      setDetail(withFormattedRates(data))
      setNotice('Draft saved.')
    } catch (err) {
      setError(getApiErrorMessage(err))
      throw err
    } finally {
      setPending(false)
    }
  }

  function requestSubmit() {
    if (!detail) return
    const missingDays = detail.coverage.filter(
      (day) =>
        isStandardWorkday(day.reportingDate) &&
        (day.status === 'MISSING' || day.status === 'DRAFT') &&
        !detail.noActivityDates.includes(day.reportingDate),
    )
    if (missingDays.length > 0 && !detail.missingDayAcknowledgement?.trim()) {
      setError('Add a short note for the weekdays that have no submitted daily report.')
      return
    }
    ask({
      title:
        detail.status === 'DRAFT'
          ? `Submit weekly invoice for ${formatRangeLabel(week.from, week.to)}?`
          : `Update weekly invoice for ${formatRangeLabel(week.from, week.to)}?`,
      description: `${totals.apps.toLocaleString()} applications, ${totals.interviews.toLocaleString()} interviews, ${formatUsd(totals.total)}. Only submitted daily reports are included.`,
      confirmLabel:
        detail.status === 'DRAFT' ? 'Submit Weekly Invoice' : 'Update Invoice',
      pendingLabel: detail.status === 'DRAFT' ? 'Submitting…' : 'Updating…',
      confirmTone: 'primary',
      action: async () => {
        await saveDraft()
        const { data } = await api.post<WeeklyInvoiceDetail>(
          `/weekly-invoices/${detail.id}/submit`,
        )
        setDetail(withFormattedRates(data))
        setNotice(
          detail.status === 'DRAFT'
            ? 'Weekly invoice submitted. Waiting for manager approval. You can still change it until it is approved.'
            : 'Weekly invoice updated. Still waiting for manager approval.',
        )
      },
    })
  }

  function openAdminInvoice(id: number) {
    navigate(`/weekly-invoices/${id}`)
  }

  function requestDelete(id: number, label?: string) {
    ask({
      title: 'Delete this weekly invoice?',
      description: label
        ? `Permanently remove ${label}. This cannot be undone.`
        : 'Permanently remove this weekly invoice. This cannot be undone.',
      confirmLabel: 'Delete invoice',
      pendingLabel: 'Deleting…',
      confirmTone: 'danger',
      action: async () => {
        try {
          await api.delete(`/weekly-invoices/${id}`)
          setNotice('Weekly invoice deleted.')
          setDetail(null)
          navigate('/weekly-invoices')
          await loadAdmin(weekStart, null)
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  async function adminAction(path: string, noticeText: string) {
    if (!detail) return
    setPending(true)
    setError('')
    try {
      const { data } = await api.post<WeeklyInvoiceDetail>(
        `/weekly-invoices/${detail.id}/${path}`,
      )
      const visibleToAdmin = data.status !== 'DRAFT'
      setNotice(noticeText)
      if (visibleToAdmin) {
        setDetail(withFormattedRates(data))
        await loadAdmin(weekStart, data.id)
      } else {
        navigate('/weekly-invoices')
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      {dialog}
      <PageHeader
        eyebrow={isAdmin ? 'Admin' : 'Operations'}
        title="Weekly Invoice"
        description={
          isAdmin
            ? 'One log of every weekly invoice — pending, approved, applications, interviews, and pay at a glance.'
            : 'Weekly progress from submitted daily reports. Review the week, then submit the invoice.'
        }
        actions={
          isAdmin ? undefined : (
          <div className="flex gap-2">
            <Button
              variant={preset === 'current' ? 'primary' : 'secondary'}
              onClick={() => {
                setPreset('current')
                setDetail(null)
              }}
            >
              This week
            </Button>
            <Button
              variant={preset === 'previous' ? 'primary' : 'secondary'}
              onClick={() => {
                setPreset('previous')
                setDetail(null)
              }}
            >
              Previous week
            </Button>
          </div>
          )
        }
      />

      {!isAdmin ? (
        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
          {formatRangeLabel(week.from, week.to)}
        </p>
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
          items={list}
          weekStart={focusWeek}
          thisMonday={thisMonday}
          onWeekChange={setFocusWeek}
          onView={(id) => void openAdminInvoice(id)}
          onDelete={(item) =>
            requestDelete(
              item.id,
              `${item.manager?.name ?? 'Bid Manager'} · ${invoiceWeekLabel(item.periodStart, item.periodEnd)}`,
            )
          }
        />
      ) : null}

      {!loading && detail && (!isAdmin || selectedId != null) ? (
        <WeekProgress
          detail={detail}
          totals={totals}
          canEdit={canEdit}
          isAdmin={isAdmin}
          pending={pending}
          lockedForManager={lockedForManager}
          onAck={(value) =>
            setDetail((current) =>
              current
                ? { ...current, missingDayAcknowledgement: value }
                : current,
            )
          }
          onSubmit={requestSubmit}
          onApprove={() =>
            void adminAction('approve', 'Weekly invoice approved.')
          }
          onReopen={() =>
            ask({
              title: 'Return this invoice to draft?',
              description: 'The Bid Manager will be able to edit and resubmit.',
              confirmLabel: 'Reopen invoice',
              pendingLabel: 'Reopening…',
              confirmTone: 'primary',
              action: async () => {
                await adminAction('reopen', 'Invoice returned to draft.')
              },
            })
          }
          onDelete={() =>
            requestDelete(
              detail.id,
              `${detail.manager?.name ?? 'Bid Manager'} · ${invoiceWeekLabel(detail.periodStart, detail.periodEnd)}`,
            )
          }
          onBack={isAdmin ? () => navigate('/weekly-invoices') : undefined}
        />
      ) : null}
    </section>
  )
}

function invoiceWeekLabel(periodStart: string, periodEnd: string) {
  const from = parseLocalDate(periodStart)
  const endExclusive = parseLocalDate(periodEnd)
  endExclusive.setDate(endExclusive.getDate() + 1)
  return formatRangeLabel(from, endExclusive)
}

function AdminList({
  items,
  weekStart,
  thisMonday,
  onWeekChange,
  onView,
  onDelete,
}: {
  items: WeeklyInvoiceListItem[]
  weekStart: string
  thisMonday: string
  onWeekChange: (next: string) => void
  onView: (id: number) => void
  onDelete: (item: WeeklyInvoiceListItem) => void
}) {
  const [filter, setFilter] = useState<AdminListFilter>('all')
  const [rangeEnd, setRangeEnd] = useState(thisMonday)
  const pendingCount = items.filter((item) => isPendingInvoice(item.status)).length
  const approvedCount = items.filter((item) => item.status === 'APPROVED').length
  const selectedWeekItems = items.filter((item) => invoiceWeekKey(item) === weekStart)
  const weeks = useMemo(() => weekWindow(rangeEnd, 8), [rangeEnd])
  const byWeek = useMemo(() => {
    const map = new Map<string, WeeklyInvoiceListItem[]>()
    for (const item of items) {
      const key = invoiceWeekKey(item)
      const bucket = map.get(key) ?? []
      bucket.push(item)
      map.set(key, bucket)
    }
    return map
  }, [items])

  const visible = items.filter((item) => {
    if (filter === 'week') {
      return invoiceWeekKey(item) === weekStart
    }
    if (filter === 'pending') {
      return isPendingInvoice(item.status)
    }
    if (filter === 'approved') {
      return item.status === 'APPROVED'
    }
    return true
  })
  const groups = groupByWeek(visible)
  const payTotal = sumUsd(items)

  function moveRange(weeksDelta: number) {
    const next = shiftMonday(rangeEnd, weeksDelta)
    const end = next > thisMonday ? thisMonday : next
    setRangeEnd(end)
    if (filter === 'week' && !weekWindow(end, 8).includes(weekStart)) {
      setFilter('all')
    }
  }

  function jumpToThisWeek() {
    setRangeEnd(thisMonday)
    onWeekChange(thisMonday)
    setFilter('week')
  }

  function selectWeek(monday: string) {
    onWeekChange(monday)
    setFilter('week')
  }

  if (items.length === 0) {
    return (
      <div className="mt-5">
        <EmptyState
          title="No submitted weekly invoices"
          description={`Bid Managers have not sent a weekly invoice for ${formatWeekSpan(weekStart)} yet. Submitted invoices will appear in this log.`}
        />
      </div>
    )
  }

  return (
    <div className="ds-board mt-5">
      <div className="ds-kpis">
        <article className="ds-kpi">
          <span className="ds-kpi-icon ds-kpi-icon--warn">
            <Clock className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="ds-kpi-label">Pending approval</p>
            <p className="ds-kpi-value">{pendingCount.toLocaleString()}</p>
          </div>
        </article>
        <article className="ds-kpi">
          <span className="ds-kpi-icon ds-kpi-icon--ok">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="ds-kpi-label">Approved</p>
            <p className="ds-kpi-value">{approvedCount.toLocaleString()}</p>
          </div>
        </article>
        <article className="ds-kpi">
          <span className="ds-kpi-icon">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="ds-kpi-label">Selected week</p>
            <p className="ds-kpi-value">{selectedWeekItems.length.toLocaleString()}</p>
            <p className="ds-kpi-hint">{formatWeekSpan(weekStart)}</p>
          </div>
        </article>
        <article className="ds-kpi">
          <span className="ds-kpi-icon ds-kpi-icon--ok">
            <Receipt className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="ds-kpi-label">Invoice total</p>
            <p className="ds-kpi-value">{formatUsd(payTotal)}</p>
          </div>
        </article>
      </div>

      <section className="ds-strip-panel" aria-label="Recent invoice weeks">
        <div className="ds-strip-head">
          <h2>Weekly log</h2>
          <div className="ds-strip-nav">
            <button
              type="button"
              className="ds-nav-btn"
              aria-label="Previous weeks"
              onClick={() => moveRange(-4)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="ds-nav-btn ds-nav-today" onClick={jumpToThisWeek}>
              This week
            </button>
            <button
              type="button"
              className="ds-nav-btn"
              aria-label="Next weeks"
              disabled={rangeEnd >= thisMonday}
              onClick={() => moveRange(4)}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p>{`${formatWeekSpan(weeks[0])} – ${formatWeekSpan(weeks[weeks.length - 1])}`}</p>
        </div>
        <div className="wi-strip">
          {weeks.map((monday) => {
            const weekItems = byWeek.get(monday) ?? []
            const pending = weekItems.some((item) => isPendingInvoice(item.status))
            const empty = weekItems.length === 0
            const isCurrent = monday === thisMonday
            const state = empty ? 'empty' : pending ? 'pending' : 'ok'
            return (
              <button
                key={monday}
                type="button"
                className={`wi-week ${monday === weekStart ? 'is-on' : ''} ${
                  isCurrent ? 'is-today' : ''
                } is-${state}`}
                onClick={() => selectWeek(monday)}
              >
                <span className="wi-week-kicker">
                  {isCurrent ? 'This week' : monday === shiftMonday(thisMonday, -1) ? 'Last week' : 'Week of'}
                </span>
                <span className="wi-week-span">{formatWeekSpan(monday)}</span>
                <span className="wi-week-c">
                  {empty ? '—' : `${weekItems.length} sent`}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="ds-toolbar">
        <div className="ds-filters" role="tablist" aria-label="Filter invoices">
          {(
            [
              ['all', 'All invoices', items.length],
              ['week', 'Selected week', selectedWeekItems.length],
              ['pending', 'Pending', pendingCount],
              ['approved', 'Approved', approvedCount],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`ds-filter ${filter === id ? 'is-on' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        {selectedWeekItems.length === 0 ? (
          <p className="ds-missing">No invoice for {formatWeekSpan(weekStart)} yet.</p>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No invoices match this filter." />
      ) : (
        <div className="table-wrap">
          <table className="table-ui ds-log wi-log">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Status</th>
                <th className="num">Applications</th>
                <th className="num">Interviews</th>
                <th className="num">Amount</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const apps = group.items.reduce((sum, item) => sum + item.applications, 0)
                const interviews = group.items.reduce((sum, item) => sum + item.interviews, 0)
                const amount = sumUsd(group.items)
                const pendingInGroup = group.items.filter((item) =>
                  isPendingInvoice(item.status),
                ).length
                return (
                  <Fragment key={group.start}>
                    <tr className={`ds-group ${group.start === weekStart ? 'is-focus' : ''}`}>
                      <td colSpan={7}>
                        <div className="ds-group-line">
                          <span>{invoiceWeekLabel(group.start, group.end)}</span>
                          <span>
                            {group.items.length === 1
                              ? '1 invoice'
                              : `${group.items.length} invoices`}
                            {pendingInGroup > 0 ? ` · ${pendingInGroup} pending` : ''}
                            {' · '}
                            {apps.toLocaleString()} apps · {interviews.toLocaleString()}{' '}
                            interviews · {formatUsd(amount)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr
                        key={item.id}
                        className={`interactive-row ${
                          invoiceWeekKey(item) === weekStart ? 'is-today' : ''
                        }`}
                        tabIndex={0}
                        onClick={() => onView(item.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onView(item.id)
                          }
                        }}
                      >
                        <td>
                          <div className="ds-manager">
                            <EntityAvatar
                              name={item.manager?.name ?? 'Bid Manager'}
                              src={item.manager?.avatarUrl}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="ds-manager-name">
                                {item.manager?.name ?? 'Bid Manager'}
                              </p>
                              <p className="ds-manager-meta">
                                {item.bidderCount === 1
                                  ? '1 bidder'
                                  : `${item.bidderCount} bidders`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge tone={statusTone(item.status)}>
                            {statusLabel(item.status)}
                          </StatusBadge>
                        </td>
                        <td className="num">{item.applications.toLocaleString()}</td>
                        <td className="num">{item.interviews.toLocaleString()}</td>
                        <td
                          className={`num ${
                            isPositiveUsd(item.totalAmount)
                              ? 'text-[var(--semantic-success)]'
                              : ''
                          }`}
                        >
                          {formatUsd(item.totalAmount)}
                        </td>
                        <td className="ds-time">
                          {item.submittedAt ? formatTime(item.submittedAt) : '—'}
                        </td>
                        <td
                          className="ds-open"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              className="!h-8 !px-2.5 !text-xs"
                              onClick={() => onView(item.id)}
                            >
                              Open
                            </Button>
                            <Button
                              variant="danger"
                              className="!h-8 !px-2.5 !text-xs"
                              onClick={() => onDelete(item)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function weekdayShort(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).toLocaleDateString('en-US', {
    weekday: 'short',
  })
}

function dayNumber(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).getDate()
}

function sameDay(left: string, right: string) {
  return left.slice(0, 10) === right.slice(0, 10)
}

function CountCell({
  applications,
  interviews,
  counted,
  emphasis = false,
}: {
  applications: number
  interviews: number
  counted: boolean
  emphasis?: boolean
}) {
  if (!counted) {
    return <span className="text-sm text-[var(--text-muted)]">—</span>
  }
  const empty = applications === 0 && interviews === 0
  return (
    <div
      className={`inline-flex min-w-[3.25rem] flex-col items-center leading-tight ${
        emphasis ? 'rounded-md bg-white/[0.05] px-1.5 py-1' : ''
      }`}
    >
      <span
        className={`tabular-nums text-[13px] font-semibold ${
          empty ? 'text-[var(--text-muted)]' : 'text-[#9cc6f8]'
        }`}
      >
        {applications.toLocaleString()}
      </span>
      <span
        className={`tabular-nums text-[11px] font-medium ${
          empty ? 'text-[var(--text-muted)]' : 'text-[#ddb46e]'
        }`}
      >
        {interviews.toLocaleString()}
      </span>
    </div>
  )
}

function WeekProgress({
  detail,
  totals,
  canEdit,
  isAdmin,
  pending,
  lockedForManager,
  onAck,
  onSubmit,
  onApprove,
  onReopen,
  onDelete,
  onBack,
}: {
  detail: WeeklyInvoiceDetail
  totals: {
    apps: number
    interviews: number
    total: string
    applicationAmount: string
    interviewAmount: string
  }
  canEdit: boolean
  isAdmin: boolean
  pending: boolean
  lockedForManager: boolean
  onAck: (value: string) => void
  onSubmit: () => void
  onApprove: () => void
  onReopen: () => void
  onDelete: () => void
  onBack?: () => void
}) {
  const days = detail.coverage
  const missing = days.filter(
    (day) =>
      isStandardWorkday(day.reportingDate) &&
      (day.status === 'MISSING' || day.status === 'DRAFT') &&
      !detail.noActivityDates.includes(day.reportingDate),
  )
  const workdays = days.filter((day) => isStandardWorkday(day.reportingDate))
  const submittedWorkdays = workdays.filter(
    (day) => day.status === 'SUBMITTED' || day.status === 'REVIEWED',
  ).length
  const dayTotals = days.map((day) => {
    let applications = 0
    let interviews = 0
    const counted = day.status === 'SUBMITTED' || day.status === 'REVIEWED'
    if (counted) {
      for (const row of detail.rows) {
        const cell = row.dailyBreakdown.find((item) =>
          sameDay(item.reportingDate, day.reportingDate),
        )
        if (!cell?.included) continue
        applications += cell.applicationCount ?? 0
        interviews += cell.interviewCount ?? 0
      }
    }
    return {
      reportingDate: day.reportingDate,
      applications,
      interviews,
      counted,
    }
  })
  const weekLabel = formatRangeLabel(
    parseLocalDate(detail.periodStart),
    new Date(parseLocalDate(detail.periodEnd).getTime() + 86400000),
  )

  return (
    <div className="mt-5 space-y-4 pb-28">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          ← All invoices
        </Button>
      ) : null}

      <section className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {weekLabel}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {detail.rows.length} bidder{detail.rows.length === 1 ? '' : 's'}
              {' · '}
              {submittedWorkdays} of {workdays.length} weekdays submitted
              {detail.manager?.name ? ` · ${detail.manager.name}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-[rgba(96,165,250,0.28)] bg-[rgba(59,130,246,0.12)] px-2.5 py-1 text-xs font-medium text-[#9cc6f8]">
                {totals.apps.toLocaleString()} applications
              </span>
              <span className="inline-flex items-center rounded-full border border-[rgba(215,169,93,0.28)] bg-[rgba(215,169,93,0.12)] px-2.5 py-1 text-xs font-medium text-[#ddb46e]">
                {totals.interviews.toLocaleString()} interviews
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {formatUsd(totals.total)}
              </span>
            </div>
          </div>
          <StatusBadge tone={statusTone(detail.status)}>
            {statusLabel(detail.status)}
          </StatusBadge>
        </div>

        {detail.rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No submitted daily reports this week"
              description="Bidder totals appear here after a daily report is submitted. Drafts are not included."
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                  <th className="sticky left-0 z-10 bg-[var(--bg-glass-solid)] py-2 pr-3 font-semibold">
                    Bidder
                  </th>
                  {days.map((day) => (
                    <th
                      key={day.reportingDate}
                      className="min-w-[72px] px-1.5 py-2 text-center font-semibold"
                    >
                      <span className="block">{weekdayShort(day.reportingDate)}</span>
                      <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-[var(--text-muted)]">
                        {dayNumber(day.reportingDate)}
                      </span>
                    </th>
                  ))}
                  <th className="min-w-[72px] px-1.5 py-2 text-center font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr
                    key={row.bidderId}
                    className="border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <td className="sticky left-0 z-10 bg-[var(--bg-glass-solid)] py-3 pr-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar
                          name={row.bidderName}
                          src={row.bidderAvatarUrl}
                          size="sm"
                        />
                        <span className="truncate font-medium text-[var(--text-primary)]">
                          {row.bidderName}
                        </span>
                      </div>
                    </td>
                    {days.map((day) => {
                      const cell = row.dailyBreakdown.find((item) =>
                        sameDay(item.reportingDate, day.reportingDate),
                      )
                      const counted =
                        day.status === 'SUBMITTED' || day.status === 'REVIEWED'
                      return (
                        <td
                          key={day.reportingDate}
                          className="px-1.5 py-3 text-center align-middle"
                        >
                          <CountCell
                            applications={cell?.applicationCount ?? 0}
                            interviews={cell?.interviewCount ?? 0}
                            counted={counted && Boolean(cell?.included)}
                          />
                        </td>
                      )
                    })}
                    <td className="px-1.5 py-3 text-center align-middle">
                      <CountCell
                        applications={row.defaultApplicationCount}
                        interviews={row.defaultInterviewCount}
                        counted
                        emphasis
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-glass-solid)] py-3 pr-3 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    Team
                  </td>
                  {dayTotals.map((day) => (
                    <td
                      key={day.reportingDate}
                      className="px-1.5 py-3 text-center align-middle"
                    >
                      <CountCell
                        applications={day.applications}
                        interviews={day.interviews}
                        counted={day.counted}
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-3 text-center align-middle">
                    <CountCell
                      applications={totals.apps}
                      interviews={totals.interviews}
                      counted
                      emphasis
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-[var(--text-muted)]">
          Each day shows{' '}
          <span className="font-medium text-[#9cc6f8]">applications</span>
          {' / '}
          <span className="font-medium text-[#ddb46e]">interviews</span>
          {' '}from submitted daily reports. Days without a submitted report are not counted.
        </p>

        {missing.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm text-[var(--text-secondary)]">
              No submitted report for{' '}
              {missing
                .map((day) => `${weekdayShort(day.reportingDate)} ${formatDay(day.reportingDate)}`)
                .join(', ')}
              .
            </p>
            {canEdit ? (
              <label className="mt-2 block text-sm text-[var(--text-secondary)]">
                Note for those days
                <textarea
                  className="input-field mt-1 min-h-16"
                  value={detail.missingDayAcknowledgement ?? ''}
                  onChange={(event) => onAck(event.target.value)}
                  placeholder="These weekdays had no submitted daily report."
                />
              </label>
            ) : detail.missingDayAcknowledgement ? (
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {detail.missingDayAcknowledgement}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {lockedForManager ? (
        <Alert tone="info">This weekly invoice is approved.</Alert>
      ) : !isAdmin &&
        (detail.status === 'SUBMITTED' || detail.status === 'REVIEWED') ? (
        <Alert tone="info">
          Waiting for approval. You can still update this invoice until it is approved.
        </Alert>
      ) : null}

      {isAdmin && detail.status !== 'DRAFT' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={pending} onClick={onReopen}>
            Return to draft
          </Button>
          <Button variant="danger" disabled={pending} onClick={onDelete}>
            Delete invoice
          </Button>
        </div>
      ) : isAdmin ? (
        <Button variant="danger" disabled={pending} onClick={onDelete}>
          Delete invoice
        </Button>
      ) : null}

      {canEdit || (isAdmin && (detail.status === 'SUBMITTED' || detail.status === 'REVIEWED')) ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-glass)] bg-[var(--bg-glass-solid)]/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">
                {totals.apps.toLocaleString()}
              </span>{' '}
              applications ·{' '}
              <span className="font-medium text-[var(--text-primary)]">
                {totals.interviews.toLocaleString()}
              </span>{' '}
              interviews ·{' '}
              <span className="font-medium text-[var(--text-primary)]">
                {formatUsd(totals.total)}
              </span>
            </p>
            <div className="flex gap-2">
              {!isAdmin && canEdit ? (
                <Button disabled={pending} onClick={onSubmit}>
                  {detail.status === 'DRAFT' ? 'Submit weekly invoice' : 'Update invoice'}
                </Button>
              ) : null}
              {isAdmin &&
              (detail.status === 'SUBMITTED' || detail.status === 'REVIEWED') ? (
                <Button disabled={pending} onClick={onApprove}>
                  Approve
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function BidderInvoicesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<PublishedWeeklyInvoice[]>([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const invoice = items[index] ?? null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api
      .get<PublishedWeeklyInvoice[]>('/weekly-invoices/published')
      .then(({ data }) => {
        if (!cancelled) {
          setItems(data)
          setIndex(0)
        }
      })
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
  }, [])

  return (
    <section>
      <PageHeader
        eyebrow="My work"
        title="Weekly Invoice"
        description="Approved team results. You can see your numbers and everyone else's after an admin approves the week."
      />
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {loading ? (
        <div className="mt-5">
          <PageSkeleton metrics={0} rows={4} />
        </div>
      ) : null}
      {!loading && !invoice ? (
        <div className="mt-5">
          <EmptyState
            title="No approved weekly invoice yet"
            description="This appears after the bid manager submits the week and an admin approves it."
          />
        </div>
      ) : null}
      {!loading && invoice ? (
        <section className="mt-5 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {invoiceWeekLabel(invoice.periodStart, invoice.periodEnd)}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Approved
                {invoice.manager?.name ? ` · ${invoice.manager.name}` : ''}
              </p>
            </div>
            <div className="ds-strip-nav">
              <button
                type="button"
                className="ds-nav-btn"
                aria-label="Older week"
                disabled={index >= items.length - 1}
                onClick={() =>
                  setIndex((current) => Math.min(items.length - 1, current + 1))
                }
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ds-nav-btn"
                aria-label="Newer week"
                disabled={index <= 0}
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                  <th className="py-2 pr-3 font-semibold">Bidder</th>
                  <th className="py-2 pr-3 text-right font-semibold">Applications</th>
                  <th className="py-2 pr-3 text-right font-semibold">Interviews</th>
                  <th className="py-2 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.rows.map((row) => {
                  const mine = row.bidderId === user?.id
                  return (
                    <tr
                      key={row.bidderId}
                      className={`border-b border-[var(--border-subtle)] last:border-b-0 ${
                        mine ? 'bg-[rgba(217,139,70,0.08)]' : ''
                      }`}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <EntityAvatar
                            name={row.bidderName}
                            src={row.bidderAvatarUrl}
                            size="sm"
                          />
                          <span className="truncate font-medium text-[var(--text-primary)]">
                            {row.bidderName}
                            {mine ? (
                              <span className="ml-2 text-xs font-semibold text-[var(--accent)]">
                                You
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-[var(--text-primary)]">
                        {row.applications.toLocaleString()}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums text-[var(--text-primary)]">
                        {row.interviews.toLocaleString()}
                      </td>
                      <td className="py-3 text-right tabular-nums font-medium text-[var(--text-primary)]">
                        {formatUsd(row.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border-subtle)]">
                  <td className="py-3 pr-3 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    Team
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                    {invoice.applications.toLocaleString()}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                    {invoice.interviews.toLocaleString()}
                  </td>
                  <td className="py-3 text-right tabular-nums font-semibold text-[var(--text-primary)]">
                    {formatUsd(invoice.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  )
}
