import {
  createContext,
  FormEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import {
  ArrowDownLeft,
  Eye,
  EyeOff,
  Landmark,
  Plus,
  Receipt,
  Scale,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  WalletLedger,
  WalletMethod,
  WalletMonthPoint,
  WalletTransaction,
  WalletTransactionType,
} from '../api/types'
import { Alert, Button } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { formatUsd, formatUsdDelta } from '../ui/money'
import { PageHeader } from '../ui/page-header'
import { parseLocalDate, toIsoDate } from '../ui/reporting-period'
import { StatusBadge } from '../ui/StatusBadge'

type TypeFilter = 'ALL' | WalletTransactionType | 'VOID'
type PeriodMode = 'all' | 'week' | 'days30' | 'month' | 'custom'

const TYPE_META: Record<
  WalletTransactionType,
  {
    label: string
    hint: string
    tone: 'in' | 'out' | 'adj'
    Icon: typeof ArrowDownLeft
  }
> = {
  RECEIVED: {
    label: 'Received',
    hint: 'Money came in',
    tone: 'in',
    Icon: ArrowDownLeft,
  },
  PAYMENT: {
    label: 'Payment',
    hint: 'You paid someone',
    tone: 'out',
    Icon: Send,
  },
  BILLING: {
    label: 'Billing',
    hint: 'Bill or invoice paid',
    tone: 'out',
    Icon: Receipt,
  },
  PAYROLL: {
    label: 'Payroll',
    hint: 'Team compensation',
    tone: 'out',
    Icon: Users,
  },
  ADJUSTMENT: {
    label: 'Adjustment',
    hint: 'Balance correction',
    tone: 'adj',
    Icon: Scale,
  },
}

const METHOD_LABEL: Record<WalletMethod, string> = {
  BANK: 'Bank transfer',
  WIRE: 'Wire',
  CASH: 'Cash',
  CARD: 'Card',
  CHECK: 'Check',
  OTHER: 'Other',
}

const EMPTY_LEDGER: WalletLedger = {
  summary: {
    balance: '0.00',
    postedCount: 0,
    periodCount: 0,
    periodIn: '0.00',
    periodOut: '0.00',
    periodNet: '0.00',
    received: '0.00',
    payment: '0.00',
    billing: '0.00',
    payroll: '0.00',
    adjustment: '0.00',
    previousPeriodIn: null,
    previousPeriodOut: null,
    previousPeriodNet: null,
  },
  spark: [],
  months: [],
  items: [],
}

function todayIso() {
  return toIsoDate(new Date())
}

function currentMonth() {
  return todayIso().slice(0, 7)
}

function monthWindow(endYm: string, count = 12): WalletMonthPoint[] {
  const [year, month] = endYm.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 - (count - 1 - index), 1)
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      ym,
      in: '0.00',
      out: '0.00',
      net: '0.00',
      netCents: 0,
      count: 0,
    }
  })
}

function monthBounds(ym: string) {
  const [year, month] = ym.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, '0')}`,
  }
}

function shiftDays(iso: string, days: number) {
  const next = parseLocalDate(iso)
  next.setDate(next.getDate() + days)
  return toIsoDate(next)
}

function weekBounds() {
  const today = parseLocalDate(todayIso())
  const offset = today.getDay() === 0 ? -6 : 1 - today.getDay()
  const from = new Date(today)
  from.setDate(today.getDate() + offset)
  return { from: toIsoDate(from), to: todayIso() }
}

function formatMonthLabel(ym: string) {
  const date = parseLocalDate(`${ym}-01`)
  return date.toLocaleDateString('en-US', { month: 'short' })
}

function formatMonthFull(ym: string) {
  const date = parseLocalDate(`${ym}-01`)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDayHeading(iso: string) {
  const date = parseLocalDate(iso)
  const today = todayIso()
  const yesterday = shiftDays(today, -1)
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

function formatRecordedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function groupByDay(items: WalletTransaction[]) {
  const groups: Array<{ date: string; rows: WalletTransaction[]; net: number }> = []
  for (const item of items) {
    const signed = item.status === 'POSTED' ? Number(item.signedAmount) : 0
    const last = groups[groups.length - 1]
    if (last && last.date === item.occurredOn) {
      last.rows.push(item)
      last.net += Number.isFinite(signed) ? signed : 0
    } else {
      groups.push({
        date: item.occurredOn,
        rows: [item],
        net: Number.isFinite(signed) ? signed : 0,
      })
    }
  }
  return groups
}

function formatCustomRange(from: string, to: string) {
  if (!from || !to) return 'Custom range'
  const start = parseLocalDate(from)
  const end = parseLocalDate(to)
  if (from === to) {
    return end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  const sameYear = start.getFullYear() === end.getFullYear()
  const left = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  })
  const right = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${left} – ${right}`
}

function orderedRange(from: string, to: string) {
  if (!from || !to) {
    const bounds = monthBounds(currentMonth())
    return { from: bounds.from, to: todayIso() }
  }
  return from <= to ? { from, to } : { from: to, to: from }
}

function periodLabel(mode: PeriodMode, month: string, customFrom: string, customTo: string) {
  if (mode === 'all') return 'All time'
  if (mode === 'week') return 'This week'
  if (mode === 'days30') return 'Last 30 days'
  if (mode === 'custom') {
    const range = orderedRange(customFrom, customTo)
    return formatCustomRange(range.from, range.to)
  }
  return formatMonthFull(month)
}

function vsPrior(current: string, previous: string | null) {
  if (previous == null) return null
  const delta = Number(current) - Number(previous)
  if (!Number.isFinite(delta)) return null
  if (delta === 0) return 'Flat vs prior period'
  return `${formatUsdDelta(delta)} vs prior`
}

function normalizeAmount(value: string) {
  return value.replace(/[$,\s]/g, '')
}

const RevealAllContext = createContext(false)

/** Money stays masked until clicked; the header eye reveals every amount at once. */
function Secret({ children, className = '' }: { children: ReactNode; className?: string }) {
  const revealAll = useContext(RevealAllContext)
  const [shown, setShown] = useState(false)
  const visible = revealAll || shown

  function toggle(event: ReactMouseEvent | ReactKeyboardEvent) {
    event.stopPropagation()
    event.preventDefault()
    setShown((value) => !value)
  }

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={visible ? 'Hide amount' : 'Show amount'}
      title={visible ? 'Click to hide' : 'Click to show amount'}
      className={`wal-secret${visible ? ' is-shown' : ''}${className ? ` ${className}` : ''}`}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event)
      }}
    >
      {visible ? children : '••••••'}
    </span>
  )
}

export function WalletPage() {
  const [ledger, setLedger] = useState<WalletLedger>(EMPTY_LEDGER)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [period, setPeriod] = useState<PeriodMode>('month')
  const [month, setMonth] = useState(currentMonth)
  const [customFrom, setCustomFrom] = useState(() => monthBounds(currentMonth()).from)
  const [customTo, setCustomTo] = useState(todayIso)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [revealAll, setRevealAll] = useState(false)
  const { ask, dialog } = useConfirmDialog()

  const query = useMemo(() => {
    if (period === 'all') {
      return { from: undefined as string | undefined, to: undefined as string | undefined }
    }
    if (period === 'week') {
      return weekBounds()
    }
    if (period === 'days30') {
      return { from: shiftDays(todayIso(), -29), to: todayIso() }
    }
    if (period === 'custom') {
      return orderedRange(customFrom, customTo)
    }
    return monthBounds(month)
  }, [period, month, customFrom, customTo])

  async function load() {
    const { data } = await api.get<WalletLedger>('/wallet', {
      params: {
        from: query.from,
        to: query.to,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        search: appliedSearch || undefined,
      },
    })
    setLedger(data)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    load()
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query.from, query.to, typeFilter, appliedSearch, reloadNonce])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (composerOpen) {
        setComposerOpen(false)
        return
      }
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composerOpen])

  const selected = ledger.items.find((row) => row.id === selectedId) ?? null
  const groups = groupByDay(ledger.items)
  const months = ledger.months.length ? ledger.months : monthWindow(currentMonth())
  const sparkMax = Math.max(1, ...ledger.spark.map((point) => Math.abs(point.netCents)))
  const latestPosted = ledger.items.find((row) => row.status === 'POSTED') ?? null
  const netTone = Number(ledger.summary.periodNet) < 0 ? 'is-out' : Number(ledger.summary.periodNet) > 0 ? 'is-in' : ''
  const priorNet = vsPrior(ledger.summary.periodNet, ledger.summary.previousPeriodNet)
  const viewLabel = periodLabel(period, month, customFrom, customTo)

  function showNotice(message: string) {
    setError('')
    setNotice(message)
  }

  function deleteRow(row: WalletTransaction) {
    ask({
      title: 'Delete this transaction?',
      description: `${TYPE_META[row.type].label} of ${formatUsd(row.amount)} for ${row.counterparty} is removed from history and available cash is recalculated. This cannot be undone.`,
      confirmLabel: 'Delete entry',
      pendingLabel: 'Deleting…',
      action: async () => {
        await api.delete(`/wallet/transactions/${row.id}`)
        showNotice('Transaction deleted from the ledger.')
        setSelectedId(null)
        setReloadNonce((value) => value + 1)
      },
    })
  }

  function voidRow(row: WalletTransaction) {
    ask({
      title: 'Void this transaction?',
      description: `${TYPE_META[row.type].label} of ${formatUsd(row.amount)} for ${row.counterparty} stays on the ledger as voided and no longer affects available cash.`,
      confirmLabel: 'Void entry',
      pendingLabel: 'Voiding…',
      action: async () => {
        await api.post(`/wallet/transactions/${row.id}/void`, {})
        showNotice('Transaction voided. Available cash was updated.')
        setSelectedId(null)
        setReloadNonce((value) => value + 1)
      },
    })
  }

  async function saveDetails(id: number, draft: DetailDraft) {
    await api.patch(`/wallet/transactions/${id}`, {
      occurredOn: draft.occurredOn,
      counterparty: draft.counterparty,
      method: draft.method,
      reference: draft.reference.trim() || '',
      notes: draft.notes.trim() || '',
    })
    showNotice('Transaction details updated.')
    setReloadNonce((value) => value + 1)
  }

  return (
    <RevealAllContext.Provider value={revealAll}>
    <section className="wal">
      {dialog}
      <PageHeader
        eyebrow="Finance"
        title="Wallet"
        description="Your private cash ledger. Only you can see these entries. Record received money, payments, bills, and payroll by hand. Void an entry to keep it off the balance, or delete it to erase it from history."
        actions={
          <>
            <Button variant="secondary" onClick={() => setRevealAll((value) => !value)}>
              {revealAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {revealAll ? 'Hide amounts' : 'Show amounts'}
            </Button>
            <Button onClick={() => setComposerOpen(true)}>
              <Plus className="h-4 w-4" />
              Record transaction
            </Button>
          </>
        }
      />

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

      {loading && ledger.items.length === 0 && !error ? (
        <div className="mt-6">
          <PageSkeleton />
        </div>
      ) : (
        <>
          <div className="wal-hero">
            <div className="wal-hero-main">
              <p className="wal-kicker">Available cash</p>
              <p className="wal-balance"><Secret>{formatUsd(ledger.summary.balance)}</Secret></p>
              <p className="wal-hero-meta">
                {ledger.summary.postedCount} posted
                {latestPosted
                  ? ` · Last ${TYPE_META[latestPosted.type].label.toLowerCase()} ${formatDayHeading(latestPosted.occurredOn).toLowerCase()}`
                  : ' · No posted movement yet'}
              </p>
            </div>
            <div className="wal-hero-side">
              <div>
                <span>In {viewLabel}</span>
                <strong className={Number(ledger.summary.periodIn) > 0 ? 'is-in' : ''}><Secret>{formatUsdDelta(ledger.summary.periodIn)}</Secret></strong>
              </div>
              <div>
                <span>Out {viewLabel}</span>
                <strong className={Number(ledger.summary.periodOut) > 0 ? 'is-out' : ''}><Secret>{formatUsd(ledger.summary.periodOut)}</Secret></strong>
              </div>
              <div>
                <span>Net</span>
                <strong className={netTone}><Secret>{formatUsdDelta(ledger.summary.periodNet)}</Secret></strong>
              </div>
              {priorNet ? <p className="wal-delta"><Secret>{priorNet}</Secret></p> : null}
            </div>
          </div>

          <div className="wal-kpis">
            <article>
              <p>Received</p>
              <strong className={Number(ledger.summary.received) > 0 ? 'is-in' : ''}><Secret>{formatUsd(ledger.summary.received)}</Secret></strong>
            </article>
            <article>
              <p>Payments</p>
              <strong><Secret>{formatUsd(ledger.summary.payment)}</Secret></strong>
            </article>
            <article>
              <p>Billing</p>
              <strong><Secret>{formatUsd(ledger.summary.billing)}</Secret></strong>
            </article>
            <article>
              <p>Payroll</p>
              <strong><Secret>{formatUsd(ledger.summary.payroll)}</Secret></strong>
            </article>
            <article>
              <p>Adjustment</p>
              <strong className={Number(ledger.summary.adjustment) < 0 ? 'is-out' : Number(ledger.summary.adjustment) > 0 ? 'is-in' : ''}>
                <Secret>{formatUsdDelta(ledger.summary.adjustment)}</Secret>
              </strong>
            </article>
          </div>

          <div className="wal-panel">
            <div className="wal-panel-head">
              <div>
                <h2>Cash movement</h2>
                <p>Daily net for the fourteen days ending this view, then twelve months of posted cash.</p>
              </div>
              <div className="wal-period">
                {(
                  [
                    ['all', 'All time'],
                    ['week', 'This week'],
                    ['days30', '30 days'],
                    ['month', 'Month'],
                    ['custom', 'Custom'],
                  ] as Array<[PeriodMode, string]>
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={period === id ? 'is-on' : ''}
                    onClick={() => setPeriod(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {period === 'custom' ? (
              <div className="wal-custom">
                <label>
                  <span>From</span>
                  <input
                    className="input-field"
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value || customFrom)}
                  />
                </label>
                <label>
                  <span>To</span>
                  <input
                    className="input-field"
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value || customTo)}
                  />
                </label>
                <p>{viewLabel}</p>
              </div>
            ) : null}
            <div className="wal-spark">
              {ledger.spark.map((point) => {
                const height = Math.max(4, Math.round((Math.abs(point.netCents) / sparkMax) * 42))
                const tone = point.netCents > 0 ? 'in' : point.netCents < 0 ? 'out' : 'flat'
                return (
                  <span
                    key={point.date}
                    className="wal-spark-col"
                    title={revealAll ? `${point.date}: ${formatUsdDelta(point.net)}` : point.date}
                  >
                    <i className={`wal-spark-bar is-${tone}`} style={{ height }} />
                    <em>{parseLocalDate(point.date).getDate()}</em>
                  </span>
                )
              })}
            </div>
            <div className="wal-months">
              {months.map((point) => (
                <button
                  key={point.ym}
                  type="button"
                  className={`wal-month${period === 'month' && month === point.ym ? ' is-on' : ''}${point.ym === currentMonth() ? ' is-now' : ''}`}
                  onClick={() => {
                    setPeriod('month')
                    setMonth(point.ym)
                  }}
                >
                  <span>{formatMonthLabel(point.ym)}</span>
                  <strong className={point.netCents < 0 ? 'is-out' : point.netCents > 0 ? 'is-in' : ''}>
                    {point.netCents === 0 ? '—' : <Secret>{formatUsdDelta(point.net)}</Secret>}
                  </strong>
                </button>
              ))}
            </div>
          </div>

          <div className="wal-toolbar">
            <div className="wal-filters" role="tablist" aria-label="Transaction type">
              {(
                [
                  ['ALL', 'All'],
                  ['RECEIVED', 'Received'],
                  ['PAYMENT', 'Payment'],
                  ['BILLING', 'Billing'],
                  ['PAYROLL', 'Payroll'],
                  ['ADJUSTMENT', 'Adjustment'],
                  ['VOID', 'Voided'],
                ] as Array<[TypeFilter, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === id}
                  className={typeFilter === id ? 'is-on' : ''}
                  onClick={() => setTypeFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <form
              className="wal-search"
              onSubmit={(event) => {
                event.preventDefault()
                setAppliedSearch(search.trim())
              }}
            >
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search counterparty, reference, notes"
              />
              {search || appliedSearch ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch('')
                    setAppliedSearch('')
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </form>
          </div>

          <div className={`wal-body${groups.length === 0 && !selected ? ' is-empty' : ''}`}>
            {groups.length === 0 ? (
              <div className="wal-empty">
                <EmptyState
                  icon={Landmark}
                  title="No cash movement in this view"
                  description="Record received money, a payment, or a bill on your account. Nobody else can see this history."
                  action={
                    <Button onClick={() => setComposerOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Record first transaction
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="wal-ledger">
                {groups.map((group) => (
                  <section key={group.date} className="wal-day">
                    <header>
                      <h3>{formatDayHeading(group.date)}</h3>
                      <span>
                        {group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'}
                        {' · '}
                        <em className={group.net < 0 ? 'is-out' : group.net > 0 ? 'is-in' : ''}>
                          <Secret>{formatUsdDelta(group.net)}</Secret>
                        </em>
                      </span>
                    </header>
                    <ul>
                      {group.rows.map((row) => {
                        const meta = TYPE_META[row.type]
                        const inflow = Number(row.signedAmount) > 0
                        const TypeIcon = meta.Icon
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              className={`wal-row${selectedId === row.id ? ' is-on' : ''}${row.status === 'VOID' ? ' is-void' : ''}`}
                              onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                            >
                              <span className={`wal-mark is-${meta.tone}`}>
                                {inflow ? <ArrowDownLeft /> : <TypeIcon />}
                              </span>
                              <span className="wal-row-main">
                                <strong>{row.counterparty}</strong>
                                <em>
                                  {meta.label}
                                  {row.reference ? ` · ${row.reference}` : ''}
                                  {' · '}
                                  {METHOD_LABEL[row.method]}
                                </em>
                              </span>
                              <span className="wal-row-amt">
                                <strong className={inflow ? 'is-in' : 'is-out'}>
                                  <Secret>{formatUsdDelta(row.signedAmount)}</Secret>
                                </strong>
                                <em>
                                  {row.status === 'VOID' ? (
                                    'Voided'
                                  ) : row.balanceAfter ? (
                                    <>
                                      Bal <Secret>{formatUsd(row.balanceAfter)}</Secret>
                                    </>
                                  ) : (
                                    'Posted'
                                  )}
                                </em>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {selected ? (
              <Inspector
                key={selected.id}
                row={selected}
                onClose={() => setSelectedId(null)}
                onVoid={() => voidRow(selected)}
                onDelete={() => deleteRow(selected)}
                onSave={saveDetails}
                onError={setError}
              />
            ) : groups.length > 0 ? (
              <aside className="wal-detail wal-idle">
                <p className="wal-kicker">{viewLabel}</p>
                <h3>{ledger.summary.periodCount} posted in view</h3>
                <p>
                  Select a transaction to inspect the counterparty, method, and running balance. This history stays on your account only.
                </p>
                <Button onClick={() => setComposerOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Record transaction
                </Button>
              </aside>
            ) : null}
          </div>
        </>
      )}

      {composerOpen ? (
        <Composer
          onClose={() => setComposerOpen(false)}
          onSaved={async (occurredOn) => {
            setComposerOpen(false)
            setTypeFilter('ALL')
            setAppliedSearch('')
            setSearch('')
            if (period !== 'custom') {
              setPeriod('month')
              setMonth(occurredOn.slice(0, 7))
            }
            showNotice('Transaction posted to the ledger.')
            setReloadNonce((value) => value + 1)
          }}
          onError={setError}
        />
      ) : null}
    </section>
    </RevealAllContext.Provider>
  )
}

type DetailDraft = {
  occurredOn: string
  counterparty: string
  method: WalletMethod
  reference: string
  notes: string
}

function Inspector({
  row,
  onClose,
  onVoid,
  onDelete,
  onSave,
  onError,
}: {
  row: WalletTransaction
  onClose: () => void
  onVoid: () => void
  onDelete: () => void
  onSave: (id: number, draft: DetailDraft) => Promise<void>
  onError: (message: string) => void
}) {
  const meta = TYPE_META[row.type]
  const [draft, setDraft] = useState<DetailDraft>({
    occurredOn: row.occurredOn,
    counterparty: row.counterparty,
    method: row.method,
    reference: row.reference ?? '',
    notes: row.notes ?? '',
  })
  const [pending, setPending] = useState(false)
  const dirty =
    draft.occurredOn !== row.occurredOn ||
    draft.counterparty !== row.counterparty ||
    draft.method !== row.method ||
    draft.reference !== (row.reference ?? '') ||
    draft.notes !== (row.notes ?? '')

  useEffect(() => {
    setDraft({
      occurredOn: row.occurredOn,
      counterparty: row.counterparty,
      method: row.method,
      reference: row.reference ?? '',
      notes: row.notes ?? '',
    })
  }, [row.id, row.occurredOn, row.counterparty, row.method, row.reference, row.notes])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    onError('')
    try {
      await onSave(row.id, draft)
    } catch (err) {
      onError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <aside className="wal-detail">
      <div>
        <p className="wal-kicker">{meta.label}</p>
        <h3>{row.counterparty}</h3>
        <p className="wal-detail-amt">
          <span className={Number(row.signedAmount) > 0 ? 'is-in' : 'is-out'}>
            <Secret>{formatUsdDelta(row.signedAmount)}</Secret>
          </span>
          {row.status === 'VOID' ? (
            <StatusBadge tone="muted">Voided</StatusBadge>
          ) : (
            <StatusBadge tone="success">Posted</StatusBadge>
          )}
        </p>
      </div>
      {row.status === 'POSTED' ? (
        <form className="wal-edit" onSubmit={submit}>
          <label>
            <span>Counterparty</span>
            <input
              className="input-field"
              value={draft.counterparty}
              onChange={(event) => setDraft({ ...draft, counterparty: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Date</span>
            <input
              className="input-field"
              type="date"
              value={draft.occurredOn}
              onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Method</span>
            <select
              className="input-field"
              value={draft.method}
              onChange={(event) => setDraft({ ...draft, method: event.target.value as WalletMethod })}
            >
              {(Object.keys(METHOD_LABEL) as WalletMethod[]).map((id) => (
                <option key={id} value={id}>
                  {METHOD_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Reference</span>
            <input
              className="input-field"
              value={draft.reference}
              onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
              placeholder="Invoice #, transfer id"
            />
          </label>
          <label className="wal-span">
            <span>Notes</span>
            <textarea
              className="input-field"
              rows={3}
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              placeholder="Optional context"
            />
          </label>
          <dl>
            <div>
              <dt>Running balance</dt>
              <dd>{row.balanceAfter ? <Secret>{formatUsd(row.balanceAfter)}</Secret> : '—'}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>
                {row.createdByName || '—'}
                {row.createdAt ? ` · ${formatRecordedAt(row.createdAt)}` : ''}
              </dd>
            </div>
          </dl>
          <div className="wal-detail-actions">
            <Button type="submit" disabled={pending || !dirty}>
              {pending ? 'Saving…' : 'Save details'}
            </Button>
            <Button variant="danger" type="button" onClick={onVoid}>
              Void
            </Button>
            <Button variant="danger" type="button" onClick={onDelete}>
              Delete
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl>
            <div>
              <dt>Date</dt>
              <dd>{formatDayHeading(row.occurredOn)}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{METHOD_LABEL[row.method]}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{row.reference || '—'}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{row.notes || '—'}</dd>
            </div>
            <div>
              <dt>Recorded by</dt>
              <dd>{row.createdByName || '—'}</dd>
            </div>
            <div>
              <dt>Voided</dt>
              <dd>
                {row.voidedByName || '—'}
                {row.voidReason ? ` · ${row.voidReason}` : ''}
              </dd>
            </div>
          </dl>
          <div className="wal-detail-actions">
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
    </aside>
  )
}

function Composer({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void
  onSaved: (occurredOn: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [type, setType] = useState<WalletTransactionType>('RECEIVED')
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN')
  const [amount, setAmount] = useState('')
  const [occurredOn, setOccurredOn] = useState(todayIso())
  const [counterparty, setCounterparty] = useState('')
  const [method, setMethod] = useState<WalletMethod>('BANK')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState('')
  const amountRef = useRef<HTMLInputElement>(null)
  const meta = TYPE_META[type]

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setLocalError('')
    onError('')
    try {
      await api.post('/wallet/transactions', {
        type,
        amount: normalizeAmount(amount),
        occurredOn,
        counterparty,
        method,
        direction: type === 'ADJUSTMENT' ? direction : undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      await onSaved(occurredOn)
    } catch (err) {
      const message = getApiErrorMessage(err)
      setLocalError(message)
      onError(message)
    } finally {
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
      <form className="dialog-panel glass-raised relative z-10 w-full max-w-xl p-5 wal-composer" onSubmit={submit}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="wal-kicker">New entry</p>
            <h2>Record transaction</h2>
            <p>You can void a posted entry to keep it off the balance, or delete it to erase it from history.</p>
          </div>
          <button type="button" className="wal-icon-btn" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {localError ? (
          <div className="mt-3">
            <Alert>{localError}</Alert>
          </div>
        ) : null}
        <div className="wal-types">
          {(Object.keys(TYPE_META) as WalletTransactionType[]).map((id) => {
            const TypeIcon = TYPE_META[id].Icon
            return (
              <button
                key={id}
                type="button"
                className={`wal-type is-${TYPE_META[id].tone}${type === id ? ' is-on' : ''}`}
                onClick={() => setType(id)}
              >
                <TypeIcon className="h-4 w-4" />
                <strong>{TYPE_META[id].label}</strong>
                <span>{TYPE_META[id].hint}</span>
              </button>
            )
          })}
        </div>
        <div className="wal-amount">
          <span>USD</span>
          <input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        {type === 'ADJUSTMENT' ? (
          <div className="wal-dir">
            <button type="button" className={direction === 'IN' ? 'is-on' : ''} onClick={() => setDirection('IN')}>
              Increase balance
            </button>
            <button type="button" className={direction === 'OUT' ? 'is-on' : ''} onClick={() => setDirection('OUT')}>
              Decrease balance
            </button>
          </div>
        ) : (
          <p className="wal-flow-hint">
            This {meta.label.toLowerCase()} {meta.tone === 'in' ? 'adds to' : 'leaves'} available cash.
          </p>
        )}
        <div className="wal-grid">
          <label>
            <span>{meta.tone === 'in' ? 'Received from' : meta.tone === 'adj' ? 'Counterparty' : 'Paid to'}</span>
            <input
              className="input-field"
              value={counterparty}
              onChange={(event) => setCounterparty(event.target.value)}
              placeholder="Person, vendor, or account"
              required
            />
          </label>
          <label>
            <span>Date</span>
            <input
              className="input-field"
              type="date"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Method</span>
            <select
              className="input-field"
              value={method}
              onChange={(event) => setMethod(event.target.value as WalletMethod)}
            >
              {(Object.keys(METHOD_LABEL) as WalletMethod[]).map((id) => (
                <option key={id} value={id}>
                  {METHOD_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Reference</span>
            <input
              className="input-field"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Invoice #, transfer id"
            />
          </label>
          <label className="wal-span">
            <span>Notes</span>
            <textarea
              className="input-field"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional context"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" type="button" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Posting…' : `Post ${meta.label.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </div>
  )
}
