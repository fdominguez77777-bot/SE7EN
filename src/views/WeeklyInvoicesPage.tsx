import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from '@/lib/navigation'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Minus,
  Receipt,
  RefreshCw,
} from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  WeeklyInvoiceCoverageStatus,
  WeeklyInvoiceDetail,
  WeeklyInvoiceListItem,
  WeeklyInvoiceRow,
  WeeklyInvoiceStatus,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button, SectionCard, StatCard } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { formatRate, formatUsd, formatUsdRate, isPositiveUsd } from '../ui/money'
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

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEK_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type AdminListFilter = 'all' | 'week' | 'pending' | 'approved'

type RowPatch = Partial<
  Pick<
    WeeklyInvoiceRow,
    | 'invoiceApplicationCount'
    | 'invoiceInterviewCount'
    | 'invoiceApplicationRate'
    | 'invoiceInterviewRate'
    | 'countAdjustmentReason'
    | 'rateAdjustmentReason'
  >
>

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

function coverageTone(
  status: WeeklyInvoiceCoverageStatus,
  reportingDate: string,
) {
  if (status === 'SUBMITTED' || status === 'REVIEWED') return 'success' as const
  if (status === 'NO_ACTIVITY') return 'info' as const
  if (status === 'WEEKEND_OFF') return 'muted' as const
  if (status === 'DRAFT' && isWeekend(reportingDate)) return 'muted' as const
  if (status === 'DRAFT') return 'warning' as const
  if (isWeekend(reportingDate)) return 'muted' as const
  return 'danger' as const
}

function coverageLabel(
  status: WeeklyInvoiceCoverageStatus,
  reportingDate: string,
) {
  if (status === 'SUBMITTED' || status === 'REVIEWED') {
    return isWeekend(reportingDate) ? 'Worked' : 'Submitted'
  }
  if (status === 'NO_ACTIVITY') return 'No activity'
  if (status === 'WEEKEND_OFF') return 'Off'
  if (status === 'DRAFT') return 'Draft'
  return 'Missing'
}

function DiffBadge({ value }: { value: number }) {
  if (value === 0) {
    return <StatusBadge tone="success">Matched</StatusBadge>
  }
  if (value > 0) {
    return <StatusBadge tone="warning">{`+${value}`}</StatusBadge>
  }
  return <StatusBadge tone="danger">{String(value)}</StatusBadge>
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

function rateChanged(invoice: string, configured: string) {
  return Number(invoice) !== Number(configured)
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
  const [openBreakdown, setOpenBreakdown] = useState<Record<number, boolean>>(
    {},
  )

  const canEdit = Boolean(
    detail &&
      ((isManager && detail.status !== 'APPROVED') ||
        (isAdmin && detail.status !== 'DRAFT')),
  )
  const lockedForManager = Boolean(isManager && detail?.status === 'APPROVED')

  const totals = useMemo(() => {
    const rows = detail?.rows ?? []
    const apps = rows.reduce((sum, row) => sum + row.invoiceApplicationCount, 0)
    const interviews = rows.reduce((sum, row) => sum + row.invoiceInterviewCount, 0)
    const applicationAmount = rows.reduce(
      (sum, row) =>
        sum + row.invoiceApplicationCount * (Number(row.invoiceApplicationRate) || 0),
      0,
    )
    const interviewAmount = rows.reduce(
      (sum, row) =>
        sum + row.invoiceInterviewCount * (Number(row.invoiceInterviewRate) || 0),
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

  function patchRow(bidderId: number, patch: RowPatch) {
    setDetail((current) => {
      if (!current) return current
      return {
        ...current,
        rows: current.rows.map((row) =>
          row.bidderId === bidderId
            ? {
                ...row,
                ...patch,
                applicationDifference:
                  (patch.invoiceApplicationCount ?? row.invoiceApplicationCount) -
                  row.defaultApplicationCount,
                interviewDifference:
                  (patch.invoiceInterviewCount ?? row.invoiceInterviewCount) -
                  row.defaultInterviewCount,
              }
            : row,
        ),
      }
    })
  }

  function payload() {
    if (!detail) return { rows: [] }
    return {
      managerNotes: detail.managerNotes,
      noActivityDates: detail.noActivityDates,
      missingDayAcknowledgement: detail.missingDayAcknowledgement,
      rows: detail.rows.map((row) => ({
        bidderId: row.bidderId,
        invoiceApplicationCount: row.invoiceApplicationCount,
        invoiceInterviewCount: row.invoiceInterviewCount,
        invoiceApplicationRate: row.invoiceApplicationRate,
        invoiceInterviewRate: row.invoiceInterviewRate,
        countAdjustmentReason: row.countAdjustmentReason,
        rateAdjustmentReason: row.rateAdjustmentReason,
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

  async function refreshDefaults() {
    if (!detail || !canEdit) return
    setError('')
    setPending(true)
    try {
      await api.patch(`/weekly-invoices/${detail.id}`, payload())
      const { data } = await api.post<WeeklyInvoiceDetail>(
        `/weekly-invoices/${detail.id}/refresh-defaults`,
      )
      setDetail(withFormattedRates(data))
      setNotice(
        'Defaults refreshed from Daily Submissions. Invoice counts were kept.',
      )
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function requestResetCounts() {
    if (!detail) return
    ask({
      title: 'Reset invoice counts to Daily Submission defaults?',
      description:
        'Invoice application and interview counts will match the verified weekly totals. Rates stay as they are.',
      confirmLabel: 'Reset counts',
      pendingLabel: 'Resetting…',
      confirmTone: 'primary',
      action: async () => {
        const { data } = await api.post<WeeklyInvoiceDetail>(
          `/weekly-invoices/${detail.id}/reset-counts`,
        )
        setDetail(withFormattedRates(data))
        setNotice('Invoice counts reset to Daily Submission defaults.')
      },
    })
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
      setError(
        'Acknowledge missing daily submissions: mark No activity or explain why those days are missing.',
      )
      return
    }
    const countIssue = detail.rows.some(
      (row) =>
        (row.invoiceApplicationCount !== row.defaultApplicationCount ||
          row.invoiceInterviewCount !== row.defaultInterviewCount) &&
        !row.countAdjustmentReason?.trim(),
    )
    if (countIssue) {
      setError(
        'Provide an adjustment reason for every bidder whose counts differ from Daily Submission totals.',
      )
      return
    }
    const rateIssue = detail.rows.some(
      (row) =>
        (rateChanged(row.invoiceApplicationRate, row.configuredApplicationRate) ||
          rateChanged(row.invoiceInterviewRate, row.configuredInterviewRate)) &&
        !row.rateAdjustmentReason?.trim(),
    )
    if (rateIssue) {
      setError(
        'Provide a rate adjustment reason when invoice rates differ from configured compensation rates.',
      )
      return
    }
    ask({
      title:
        detail.status === 'DRAFT'
          ? `Submit weekly invoice for ${formatRangeLabel(week.from, week.to)}?`
          : `Update weekly invoice for ${formatRangeLabel(week.from, week.to)}?`,
      description: `Applications: ${totals.apps.toLocaleString()}. Interview schedules: ${totals.interviews}. Total bidder pay: ${formatUsd(totals.total)}. You can keep editing until a manager approves this invoice.`,
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
            : 'Review verified bidder activity and submit the weekly performance invoice.'
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
        <InvoiceWorkspace
          detail={detail}
          totals={totals}
          canEdit={canEdit}
          isAdmin={isAdmin}
          pending={pending}
          lockedForManager={lockedForManager}
          openBreakdown={openBreakdown}
          onToggleBreakdown={(id) =>
            setOpenBreakdown((current) => ({ ...current, [id]: !current[id] }))
          }
          onPatchRow={patchRow}
          onNotes={(value) =>
            setDetail((current) =>
              current ? { ...current, managerNotes: value } : current,
            )
          }
          onAck={(value) =>
            setDetail((current) =>
              current
                ? { ...current, missingDayAcknowledgement: value }
                : current,
            )
          }
          onToggleNoActivity={(date, enabled) =>
            setDetail((current) => {
              if (!current) return current
              const next = new Set(current.noActivityDates)
              if (enabled) next.add(date)
              else next.delete(date)
              return {
                ...current,
                noActivityDates: [...next],
                coverage: current.coverage.map((day) => {
                  if (day.reportingDate !== date) return day
                  if (enabled) {
                    return { ...day, status: 'NO_ACTIVITY' as const }
                  }
                  if (day.dailySubmissionId) {
                    return { ...day, status: 'DRAFT' as const }
                  }
                  return {
                    ...day,
                    status: isWeekend(date)
                      ? ('WEEKEND_OFF' as const)
                      : ('MISSING' as const),
                  }
                }),
              }
            })
          }
          onSave={() => void saveDraft()}
          onRefresh={() => void refreshDefaults()}
          onReset={requestResetCounts}
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
          onBack={
            isAdmin ? () => navigate('/weekly-invoices') : undefined
          }
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

function InvoiceWorkspace({
  detail,
  totals,
  canEdit,
  isAdmin,
  pending,
  lockedForManager,
  openBreakdown,
  onToggleBreakdown,
  onPatchRow,
  onNotes,
  onAck,
  onToggleNoActivity,
  onSave,
  onRefresh,
  onReset,
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
  openBreakdown: Record<number, boolean>
  onToggleBreakdown: (id: number) => void
  onPatchRow: (bidderId: number, patch: RowPatch) => void
  onNotes: (value: string) => void
  onAck: (value: string) => void
  onToggleNoActivity: (date: string, enabled: boolean) => void
  onSave: () => void
  onRefresh: () => void
  onReset: () => void
  onSubmit: () => void
  onApprove: () => void
  onReopen: () => void
  onDelete: () => void
  onBack?: () => void
}) {
  const missing = detail.coverage.filter(
    (day) =>
      isStandardWorkday(day.reportingDate) &&
      (day.status === 'MISSING' || day.status === 'DRAFT'),
  )
  const workdays = detail.coverage.filter((day) =>
    isStandardWorkday(day.reportingDate),
  )
  const accountedWorkdays = workdays.filter(
    (day) =>
      day.status === 'SUBMITTED' ||
      day.status === 'REVIEWED' ||
      day.status === 'NO_ACTIVITY',
  ).length
  const weekendDays = detail.coverage.filter((day) => isWeekend(day.reportingDate))
  const weekendWorked = weekendDays.filter(
    (day) => day.status === 'SUBMITTED' || day.status === 'REVIEWED',
  )
  const weekendTotals = detail.rows.reduce(
    (acc, row) => {
      for (const day of row.dailyBreakdown) {
        if (!isWeekend(day.reportingDate) || !day.included) continue
        acc.apps += day.applicationCount ?? 0
        acc.interviews += day.interviewCount ?? 0
        acc.applicationAmount +=
          (day.applicationCount ?? 0) * (Number(row.invoiceApplicationRate) || 0)
        acc.interviewAmount +=
          (day.interviewCount ?? 0) * (Number(row.invoiceInterviewRate) || 0)
      }
      return acc
    },
    { apps: 0, interviews: 0, applicationAmount: 0, interviewAmount: 0 },
  )
  return (
    <div className="mt-5 space-y-4 pb-28">
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          ← All invoices
        </Button>
      ) : null}

      <div className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
              Weekly Invoice
            </p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {formatRangeLabel(
                parseLocalDate(detail.periodStart),
                new Date(
                  parseLocalDate(detail.periodEnd).getTime() + 86400000,
                ),
              )}
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
        <StatCard
          value={totals.apps.toLocaleString()}
          label="Applications"
          icon={FileSpreadsheet}
          tone="neutral"
        />
        <StatCard
          value={totals.interviews.toLocaleString()}
          label="Interview schedules"
          icon={Receipt}
          tone="neutral"
        />
        <StatCard
          value={detail.summary.activeBidders}
          label="Active bidders"
          tone="neutral"
        />
        <StatCard
          value={formatUsd(totals.total)}
          label="Bidder invoice total"
          tone={isPositiveUsd(totals.total) ? 'success' : 'neutral'}
        />
      </div>

      <SectionCard
        title="Daily Submission Coverage"
        description="Monday–Friday are required workdays. Saturday and Sunday are optional and only count when a Daily Submission exists."
      >
        <div className="mb-3 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
          <p>
            Workdays:{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {accountedWorkdays} / {workdays.length}
            </span>{' '}
            accounted for
            {missing.length > 0
              ? ` · ${missing.length} weekday need${missing.length === 1 ? 's' : ''} attention`
              : ''}
          </p>
          <p>
            Weekend:{' '}
            {weekendWorked.length === 0
              ? 'None'
              : weekendDays
                  .map((day) => {
                    const name =
                      WEEK_NAMES[
                        detail.coverage.findIndex(
                          (item) => item.reportingDate === day.reportingDate,
                        )
                      ]
                    if (day.status === 'SUBMITTED' || day.status === 'REVIEWED') {
                      return `${name} — Worked`
                    }
                    return `${name} — Off`
                  })
                  .join(' · ')}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {detail.coverage.map((day, index) => (
            <div
              key={day.reportingDate}
              className={`rounded-lg border px-2 py-3 text-center ${
                isWeekend(day.reportingDate)
                  ? 'border-[var(--border-glass)] bg-white/5'
                  : 'border-[var(--border-glass)] bg-[var(--bg-glass-solid)]'
              }`}
            >
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {WEEK_LABELS[index]}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                {isWeekend(day.reportingDate) ? 'Weekend' : 'Workday'}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {formatDay(day.reportingDate)}
              </p>
              <div className="mt-2 flex justify-center">
                {day.status === 'SUBMITTED' || day.status === 'REVIEWED' ? (
                  <Check className="h-4 w-4 text-[var(--semantic-success)]" />
                ) : day.status === 'NO_ACTIVITY' ? (
                  <Minus className="h-4 w-4 text-[var(--text-muted)]" />
                ) : (
                  <span className="text-[var(--text-muted)]">—</span>
                )}
              </div>
              <div className="mt-2">
                <StatusBadge tone={coverageTone(day.status, day.reportingDate)}>
                  {coverageLabel(day.status, day.reportingDate)}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
        {missing.length > 0 ? (
          <div className="mt-4 space-y-3 rounded-lg border border-[rgba(215,169,93,0.28)] bg-[rgba(215,169,93,0.1)] px-4 py-3">
            <Alert tone="warning">
              {missing.length} weekday{missing.length === 1 ? '' : 's'}{' '}
              {missing.length === 1 ? 'has' : 'have'} no submitted daily report.
              Mark No activity or add a reason before submitting.
            </Alert>
            {canEdit
              ? missing.map((day) => (
                  <label
                    key={day.reportingDate}
                    className="flex items-center gap-2 text-sm text-[var(--text-primary)]"
                  >
                    <input
                      type="checkbox"
                      checked={detail.noActivityDates.includes(day.reportingDate)}
                      onChange={(e) =>
                        onToggleNoActivity(day.reportingDate, e.target.checked)
                      }
                    />
                    {
                      WEEK_NAMES[
                        detail.coverage.findIndex(
                          (item) => item.reportingDate === day.reportingDate,
                        )
                      ]
                    }{' '}
                    {formatDay(day.reportingDate)} — No activity
                  </label>
                ))
              : null}
            {canEdit ? (
              <label className="block text-sm text-[var(--text-secondary)]">
                Missing weekday reason
                <textarea
                  className="input-field mt-1 min-h-20"
                  value={detail.missingDayAcknowledgement ?? ''}
                  onChange={(e) => onAck(e.target.value)}
                  placeholder="Explain why a required weekday has no Daily Submission."
                />
              </label>
            ) : detail.missingDayAcknowledgement ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {detail.missingDayAcknowledgement}
              </p>
            ) : null}
          </div>
        ) : null}
        {isAdmin && weekendWorked.length > 0 ? (
          <div className="mt-4 rounded-lg border border-[var(--border-glass)] bg-white/[0.04] px-4 py-3 text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">Weekend activity</p>
            <p className="mt-1">
              {weekendTotals.apps.toLocaleString()} applications ·{' '}
              {weekendTotals.interviews === 1
                ? '1 interview'
                : `${weekendTotals.interviews.toLocaleString()} interviews`}{' '}
              ·{' '}
              {formatUsd(
                weekendTotals.applicationAmount + weekendTotals.interviewAmount,
              )}{' '}
              attributable performance pay
            </p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Weekly bidder invoice"
        description="Defaults come from submitted Daily Submissions. Invoice values are what you send to Admin."
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={pending} onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
                Refresh from Daily Submissions
              </Button>
              <Button variant="ghost" disabled={pending} onClick={onReset}>
                Reset counts to defaults
              </Button>
            </div>
          ) : null
        }
      >
        <div className="space-y-4">
          {detail.rows.map((row) => (
            <BidderInvoiceCard
              key={row.bidderId}
              row={row}
              canEdit={canEdit}
              open={Boolean(openBreakdown[row.bidderId])}
              onToggle={() => onToggleBreakdown(row.bidderId)}
              onPatch={onPatchRow}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Weekly bidder invoice total">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">Applications</p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">
              {totals.apps.toLocaleString()}
            </p>
            <p
              className={`text-sm ${
                isPositiveUsd(totals.applicationAmount)
                  ? 'text-[var(--semantic-success)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {formatUsd(totals.applicationAmount)}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">Interview schedules</p>
            <p className="text-lg font-semibold text-[var(--text-primary)]">
              {totals.interviews.toLocaleString()}
            </p>
            <p
              className={`text-sm ${
                isPositiveUsd(totals.interviewAmount)
                  ? 'text-[var(--semantic-success)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {formatUsd(totals.interviewAmount)}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-[var(--text-secondary)]">Total bidder pay</p>
            <p
              className={`text-2xl font-semibold ${
                isPositiveUsd(totals.total)
                  ? 'text-[var(--semantic-success)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {formatUsd(totals.total)}
            </p>
          </div>
        </div>
      </SectionCard>

      {canEdit || detail.managerNotes ? (
        <label className="block text-sm text-[var(--text-secondary)]">
          Manager notes
          <textarea
            className="input-field mt-1 min-h-20"
            disabled={!canEdit}
            value={detail.managerNotes ?? ''}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Optional notes for Admin review"
          />
        </label>
      ) : null}

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-glass)] bg-[var(--bg-glass-solid)]/95 px-4 py-3 backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">
                {formatUsd(totals.total)}
              </span>{' '}
              total bidder pay
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
                    ? 'Submit Weekly Invoice'
                    : 'Update submitted invoice'}
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

      {isAdmin && detail.status !== 'DRAFT' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onReopen}>
            Return to Draft
          </Button>
          <Button variant="danger" disabled={pending} onClick={onDelete}>
            Delete invoice
          </Button>
        </div>
      ) : isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={pending} onClick={onDelete}>
            Delete invoice
          </Button>
        </div>
      ) : null}

      {lockedForManager ? (
        <Alert tone="info">
          This weekly invoice is approved. Only a manager can change it.
        </Alert>
      ) : !isAdmin &&
        (detail.status === 'SUBMITTED' || detail.status === 'REVIEWED') ? (
        <Alert tone="info">
          Waiting for manager approval. You can still change this invoice until it
          is approved.
        </Alert>
      ) : null}
    </div>
  )
}

function BidderInvoiceCard({
  row,
  canEdit,
  open,
  onToggle,
  onPatch,
}: {
  row: WeeklyInvoiceRow
  canEdit: boolean
  open: boolean
  onToggle: () => void
  onPatch: (bidderId: number, patch: RowPatch) => void
}) {
  const countChanged =
    row.invoiceApplicationCount !== row.defaultApplicationCount ||
    row.invoiceInterviewCount !== row.defaultInterviewCount
  const rateDiff =
    rateChanged(row.invoiceApplicationRate, row.configuredApplicationRate) ||
    rateChanged(row.invoiceInterviewRate, row.configuredInterviewRate)

  return (
    <article className="rounded-xl border border-[var(--border-glass)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <EntityAvatar name={row.bidderName} src={row.bidderAvatarUrl} />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">{row.bidderName}</p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {`${row.assignedProfileCount} assigned profile${row.assignedProfileCount === 1 ? '' : 's'}${row.isActive ? '' : ' · Disabled'}${row.rateSource === 'individual' ? ' · Individual rate' : ''}`}
            </p>
          </div>
        </div>
        <p
          className={`num-metric text-2xl ${
            isPositiveUsd(row.totalAmount)
              ? 'text-[var(--semantic-success)]'
              : 'text-[var(--text-primary)]'
          }`}
        >
          {formatUsd(row.totalAmount)}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass-control px-3 py-3">
          <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
            Daily verified defaults
          </p>
          <div className="mt-2 flex justify-between text-sm">
            <span>Applications</span>
            <span className="font-semibold">{row.defaultApplicationCount}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span>Interview schedules</span>
            <span className="font-semibold">{row.defaultInterviewCount}</span>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--border-glass)] bg-[var(--bg-control)] px-3 py-3">
          <p className="text-[11px] font-medium tracking-[0.16em] text-[var(--text-muted)] uppercase">
            Weekly invoice
          </p>
          <label className="mt-2 block text-xs text-[var(--text-secondary)]">
            Applications
            <input
              className="input-field mt-1"
              type="number"
              min={0}
              disabled={!canEdit}
              value={row.invoiceApplicationCount}
              onChange={(e) =>
                onPatch(row.bidderId, {
                  invoiceApplicationCount: Math.max(
                    0,
                    Number(e.target.value) || 0,
                  ),
                })
              }
            />
          </label>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span>Difference</span>
            <DiffBadge value={row.applicationDifference} />
          </div>
          <label className="mt-2 block text-xs text-[var(--text-secondary)]">
            App rate
            <input
              className="input-field mt-1"
              disabled={!canEdit}
              inputMode="decimal"
              value={row.invoiceApplicationRate}
              onChange={(e) =>
                onPatch(row.bidderId, { invoiceApplicationRate: e.target.value })
              }
              onBlur={() =>
                onPatch(row.bidderId, {
                  invoiceApplicationRate: formatRate(row.invoiceApplicationRate),
                })
              }
            />
          </label>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Configured {formatUsdRate(row.configuredApplicationRate)} ·{' '}
            {row.invoiceApplicationCount} × {formatUsdRate(row.invoiceApplicationRate)}{' '}
            ={' '}
            <span
              className={`font-medium ${
                isPositiveUsd(row.applicationAmount)
                  ? 'text-[var(--semantic-success)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {formatUsd(row.applicationAmount)}
            </span>
          </p>
          <label className="mt-3 block text-[13px] text-[var(--text-secondary)]">
            Interview schedules
            <input
              className="input-field mt-1"
              type="number"
              min={0}
              disabled={!canEdit}
              value={row.invoiceInterviewCount}
              onChange={(e) =>
                onPatch(row.bidderId, {
                  invoiceInterviewCount: Math.max(
                    0,
                    Number(e.target.value) || 0,
                  ),
                })
              }
            />
          </label>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span>Difference</span>
            <DiffBadge value={row.interviewDifference} />
          </div>
          <label className="mt-2 block text-xs text-[var(--text-secondary)]">
            Interview rate
            <input
              className="input-field mt-1"
              disabled={!canEdit}
              inputMode="decimal"
              value={row.invoiceInterviewRate}
              onChange={(e) =>
                onPatch(row.bidderId, { invoiceInterviewRate: e.target.value })
              }
              onBlur={() =>
                onPatch(row.bidderId, {
                  invoiceInterviewRate: formatRate(row.invoiceInterviewRate),
                })
              }
            />
          </label>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Configured {formatUsdRate(row.configuredInterviewRate)} ·{' '}
            {row.invoiceInterviewCount} × {formatUsdRate(row.invoiceInterviewRate)} ={' '}
            <span
              className={`font-medium ${
                isPositiveUsd(row.interviewAmount)
                  ? 'text-[var(--semantic-success)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {formatUsd(row.interviewAmount)}
            </span>
          </p>
        </div>
      </div>

      {canEdit && countChanged ? (
        <label className="mt-3 block text-sm text-[var(--text-secondary)]">
          Count adjustment reason
          <input
            className="input-field mt-1"
            value={row.countAdjustmentReason ?? ''}
            onChange={(e) =>
              onPatch(row.bidderId, { countAdjustmentReason: e.target.value })
            }
            placeholder="Two Gmail confirmations arrived after Friday's daily report."
          />
        </label>
      ) : row.countAdjustmentReason ? (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Count reason: {row.countAdjustmentReason}
        </p>
      ) : null}

      {canEdit && rateDiff ? (
        <label className="mt-3 block text-sm text-[var(--text-secondary)]">
          Rate adjustment reason
          <input
            className="input-field mt-1"
            value={row.rateAdjustmentReason ?? ''}
            onChange={(e) =>
              onPatch(row.bidderId, { rateAdjustmentReason: e.target.value })
            }
            placeholder="Special weekly rate agreed with ADMIN."
          />
        </label>
      ) : row.rateAdjustmentReason ? (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Rate reason: {row.rateAdjustmentReason}
        </p>
      ) : null}

      <button
        type="button"
        className="mt-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        onClick={onToggle}
      >
        {open ? 'Hide daily breakdown' : 'Daily breakdown'}
      </button>
      {open ? (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="py-1 pr-3">Day</th>
                <th className="py-1 pr-3">Apps</th>
                <th className="py-1 pr-3">Interviews</th>
                <th className="py-1">Source</th>
              </tr>
            </thead>
            <tbody>
              {row.dailyBreakdown.map((day, index) => {
                const weekend = isWeekend(day.reportingDate)
                let source = 'Not included'
                if (day.included) {
                  source = weekend ? 'Weekend work' : 'Daily submission'
                  if (day.applicationCount === 0 && day.interviewCount === 0) {
                    source = 'Submitted'
                  }
                } else if (weekend) {
                  source = 'Weekend / Off'
                }
                return (
                  <tr
                    key={day.reportingDate}
                    className={`border-t border-[var(--border-glass)] ${weekend ? 'bg-white/5' : ''}`}
                  >
                    <td className="py-1.5 pr-3">
                      {WEEK_NAMES[index]} {formatDay(day.reportingDate)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {day.included ? day.applicationCount : '—'}
                    </td>
                    <td className="py-1.5 pr-3">
                      {day.included ? day.interviewCount : '—'}
                    </td>
                    <td className="py-1.5 text-[var(--text-muted)]">{source}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  )
}
