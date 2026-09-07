import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link, useSearchParams } from '../routing'
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, GripVertical, Search } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  ApplicationBidderOption,
  ApplicationTablePage,
  ApplicationTableRow,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { ApplicationDetailModal } from '../ui/ApplicationDetailModal'
import { Alert, Button } from '../ui/chrome'
import { TableSkeleton } from '../ui/loading/page-skeletons'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge, applicationStatusTone } from '../ui/StatusBadge'
import {
  jobApplicationSourceLabel,
  jobApplicationStatusLabel,
} from '../ui/job-application'

const PAGE_SIZES = [25, 50, 100]

const TABLE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
]

type ColumnKey = 'companyName' | 'jobTitle' | 'source' | 'status' | 'appliedAt' | 'bidderName'

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'companyName', label: 'Company' },
  { key: 'jobTitle', label: 'Position' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'appliedAt', label: 'Applied' },
  { key: 'bidderName', label: 'Bidder' },
]

const DEFAULT_COLUMN_ORDER = COLUMNS.map((column) => column.key)
const COLUMN_LABEL: Record<ColumnKey, string> = Object.fromEntries(
  COLUMNS.map((column) => [column.key, column.label]),
) as Record<ColumnKey, string>
const ORDER_STORAGE_KEY = 'bp_apps_column_order'

const EMPTY_COLUMN_FILTERS: Record<ColumnKey, string> = {
  companyName: '',
  jobTitle: '',
  source: '',
  status: '',
  appliedAt: '',
  bidderName: '',
}

function formatApplied(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function columnText(item: ApplicationTableRow, key: ColumnKey) {
  if (key === 'appliedAt') {
    return item.appliedAt ? `${item.appliedAt} ${formatApplied(item.appliedAt)}` : ''
  }
  if (key === 'source') {
    return jobApplicationSourceLabel(item.source)
  }
  if (key === 'status') {
    return jobApplicationStatusLabel(item.status)
  }
  return String(item[key] || '')
}

function pageWindow(total: number) {
  if (total <= 6) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }
  return [1, 2, 3, 4, 5, '…', total] as const
}

function isColumnKey(value: string): value is ColumnKey {
  return DEFAULT_COLUMN_ORDER.includes(value as ColumnKey)
}

function loadColumnOrder(): ColumnKey[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) {
      return DEFAULT_COLUMN_ORDER
    }
    const valid = parsed.filter((key): key is ColumnKey => typeof key === 'string' && isColumnKey(key))
    const missing = DEFAULT_COLUMN_ORDER.filter((key) => !valid.includes(key))
    return [...valid, ...missing]
  } catch {
    return DEFAULT_COLUMN_ORDER
  }
}

function moveColumn(order: ColumnKey[], from: ColumnKey, to: ColumnKey) {
  if (from === to) {
    return order
  }
  const next = order.filter((key) => key !== from)
  const at = next.indexOf(to)
  next.splice(at < 0 ? next.length : at, 0, from)
  return next
}

function ApplicationCell({
  item,
  column,
}: {
  item: ApplicationTableRow
  column: ColumnKey
}) {
  if (column === 'companyName') {
    return <td className="font-semibold text-[var(--text-primary)]">{item.companyName}</td>
  }
  if (column === 'jobTitle') {
    return <td className="text-[var(--text-primary)]">{item.jobTitle}</td>
  }
  if (column === 'source') {
    return (
      <td>
        <StatusBadge muted>{jobApplicationSourceLabel(item.source) || '—'}</StatusBadge>
      </td>
    )
  }
  if (column === 'status') {
    return (
      <td>
        <StatusBadge tone={applicationStatusTone(item.status)}>
          {jobApplicationStatusLabel(item.status)}
        </StatusBadge>
      </td>
    )
  }
  if (column === 'appliedAt') {
    return (
      <td className="whitespace-nowrap">
        {item.appliedAt ? formatApplied(item.appliedAt) : '—'}
      </td>
    )
  }
  return (
    <td>
      {item.bidderName ? <StatusBadge muted>{item.bidderName}</StatusBadge> : '—'}
    </td>
  )
}

export function ApplicationsPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const [searchParams] = useSearchParams()
  const urlBidderId = searchParams.get('bidderId') || ''
  const urlApplicationId = searchParams.get('applicationId') || ''
  const [items, setItems] = useState<ApplicationTableRow[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [bidders, setBidders] = useState<ApplicationBidderOption[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [keyword, setKeyword] = useState('')
  const [bidderFilter, setBidderFilter] = useState(urlBidderId)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [viewing, setViewing] = useState<ApplicationTableRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showColumnFilters, setShowColumnFilters] = useState(false)
  const [columnFilters, setColumnFilters] = useState(EMPTY_COLUMN_FILTERS)
  const [appliedColumnFilters, setAppliedColumnFilters] = useState(EMPTY_COLUMN_FILTERS)
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(loadColumnOrder)
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnKey | null>(null)

  useEffect(() => {
    setBidderFilter(urlBidderId)
    setPage(1)
  }, [urlBidderId])

  async function load() {
    await api
      .get<ApplicationTablePage>('/applications', {
        params: {
          page,
          limit: pageSize,
          keyword: keyword.length >= 2 ? keyword : undefined,
          status: statusFilter || undefined,
          bidderId: isStaff ? bidderFilter || undefined : undefined,
          company: appliedColumnFilters.companyName.trim() || undefined,
          position: appliedColumnFilters.jobTitle.trim() || undefined,
          source: appliedColumnFilters.source.trim() || undefined,
          statusContains: appliedColumnFilters.status.trim() || undefined,
          applied: appliedColumnFilters.appliedAt.trim() || undefined,
          bidderName: appliedColumnFilters.bidderName.trim() || undefined,
        },
      })
      .then(({ data }) => {
        setItems(data.items)
        setCount(data.count)
      })
    if (isStaff) {
      try {
        const { data } = await api.get<ApplicationBidderOption[]>('/applications/bidders')
        setBidders(data)
      } catch {
        setBidders([])
      }
    }
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [page, pageSize, keyword, statusFilter, bidderFilter, isStaff, appliedColumnFilters])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const same = COLUMNS.every(
        (column) => appliedColumnFilters[column.key] === columnFilters[column.key],
      )
      if (same) {
        return
      }
      setPage(1)
      setAppliedColumnFilters({ ...columnFilters })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [columnFilters, appliedColumnFilters])

  useEffect(() => {
    if (!urlApplicationId) {
      return
    }
    void openView({ id: Number(urlApplicationId) } as ApplicationTableRow)
  }, [urlApplicationId])

  useEffect(() => {
    if (!viewing) {
      return
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setViewing(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing])

  async function openView(item: ApplicationTableRow) {
    if (!item.id) {
      return
    }
    setError('')
    setViewing(item)
    setDetailLoading(true)
    try {
      const { data } = await api.get<ApplicationTableRow>(`/applications/${item.id}`)
      setViewing(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }

  const visible = useMemo(() => {
    if (!sortKey) {
      return items
    }
    return [...items].sort((a, b) => {
      const left = columnText(a, sortKey).toLowerCase()
      const right = columnText(b, sortKey).toLowerCase()
      const compared = left.localeCompare(right)
      return sortDir === 'asc' ? compared : -compared
    })
  }, [items, sortKey, sortDir])

  const visibleColumns = columnOrder

  useEffect(() => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
  }, [columnOrder])

  const pageCount = Math.max(1, Math.ceil((count ?? items.length) / pageSize) || 1)
  const currentPage = Math.min(page, pageCount)
  const pages = pageWindow(pageCount)

  function toggleSort(key: ColumnKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
      return
    }
    setSortDir((value) => (value === 'asc' ? 'desc' : 'asc'))
  }

  function runSearch() {
    setPage(1)
    setKeyword(query.trim())
  }

  function onColumnDragStart(event: DragEvent<HTMLElement>, key: ColumnKey) {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
    event.dataTransfer.setData('application/x-apps-column', key)
    setDraggingColumn(key)
  }

  function onColumnDragEnd() {
    setDraggingColumn(null)
    setDropTarget(null)
  }

  function readDraggedColumn(event: DragEvent) {
    const value =
      event.dataTransfer.getData('application/x-apps-column') ||
      event.dataTransfer.getData('text/plain')
    return isColumnKey(value) ? value : draggingColumn
  }

  function onDropReorder(event: DragEvent, target: ColumnKey) {
    event.preventDefault()
    const from = readDraggedColumn(event)
    if (!from) {
      return
    }
    setColumnOrder((current) => moveColumn(current, from, target))
    onColumnDragEnd()
  }

  return (
    <section className="apps-page">
      <p className="apps-crumb">Operations &gt; Applications</p>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
        Applications
      </h1>
      <p className="apps-count">
        {(count ?? items.length).toLocaleString()} application
        {(count ?? items.length) === 1 ? '' : 's'}
      </p>

      {urlBidderId || urlApplicationId ? (
        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
          Filtered from another page.
          <Link
            to="/applications"
            className="ml-2 text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            Clear filter
          </Link>
        </p>
      ) : null}

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="filter-toolbar apps-controls glass-toolbar mt-5 px-3 py-2.5">
        <label className="filter-search input-with-icon">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            className="input-field mt-0"
            placeholder="Search companies"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                runSearch()
              }
            }}
          />
        </label>
        <Button onClick={runSearch}>Search</Button>
        {isStaff ? (
          <div className="apps-field">
            <label htmlFor="apps-user">User</label>
            <select
              id="apps-user"
              className="input-field"
              value={bidderFilter}
              onChange={(e) => {
                setBidderFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All users</option>
              {bidders.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="apps-field">
          <label htmlFor="apps-status">Status</label>
          <select
            id="apps-status"
            className="input-field"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {TABLE_STATUSES.map((row) => (
              <option key={row.value} value={row.value}>
                {row.label}
              </option>
            ))}
          </select>
        </div>
        <div className="apps-field">
          <label htmlFor="apps-page-size">Per page</label>
          <select
            id="apps-page-size"
            className="input-field"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="mt-5">
          <TableSkeleton rows={8} />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No applications yet"
            description="Applications from JiraCoders will appear here when the API token is configured."
          />
        </div>
      ) : (
        <div className="table-wrap apps-grid-shell mt-5">
          <div className="apps-grid-toolbar">
            <div className="apps-grid-tools">
              <button
                type="button"
                className={`apps-tool-btn ${showColumnFilters ? 'is-on' : ''}`}
                aria-label="Show/Hide filters"
                title="Show/Hide filters"
                aria-pressed={showColumnFilters}
                onClick={() => setShowColumnFilters((open) => !open)}
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
            <div className="apps-grid-pager">
              <button
                type="button"
                className="apps-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage(1)}
                aria-label="First page"
              >
                <ChevronsLeft className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                className="apps-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="mx-auto h-4 w-4" />
              </button>
              {pages.map((entry, index) =>
                entry === '…' ? (
                  <span key={`gap-${index}`} className="px-1 text-[12px] text-[var(--text-muted)]">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    className={`apps-page-btn ${entry === currentPage ? 'is-current' : ''}`}
                    onClick={() => setPage(Number(entry))}
                  >
                    {entry}
                  </button>
                ),
              )}
              <button
                type="button"
                className="apps-page-btn"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                className="apps-page-btn"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(pageCount)}
                aria-label="Last page"
              >
                <ChevronsRight className="mx-auto h-4 w-4" />
              </button>
            </div>
          </div>
          <table className="table-ui apps-grid">
            <thead>
              <tr>
                {visibleColumns.map((key) => (
                  <th
                    key={key}
                    className={`${draggingColumn === key ? 'is-dragging' : ''} ${dropTarget === key ? 'is-drop' : ''}`}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDropTarget(key)
                    }}
                    onDrop={(event) => onDropReorder(event, key)}
                  >
                    <button
                      type="button"
                      className="apps-th-title"
                      onClick={() => toggleSort(key)}
                    >
                      {COLUMN_LABEL[key]}
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                    </button>
                    <span
                      className="apps-th-grip"
                      draggable
                      role="button"
                      tabIndex={0}
                      title="Drag to reorder"
                      aria-label={`Move ${COLUMN_LABEL[key]} column`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onDragStart={(event) => onColumnDragStart(event, key)}
                      onDragEnd={onColumnDragEnd}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </span>
                  </th>
                ))}
              </tr>
              {showColumnFilters ? (
                <tr className="apps-filter-row">
                  {visibleColumns.map((key) => (
                    <th
                      key={`${key}-filter`}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                        setDropTarget(key)
                      }}
                      onDrop={(event) => onDropReorder(event, key)}
                    >
                      <label className="apps-col-filter">
                        <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                        <input
                          className="apps-col-filter-input"
                          placeholder={`Filter by ${COLUMN_LABEL[key]}`}
                          value={columnFilters[key]}
                          onChange={(event) =>
                            setColumnFilters((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <p className="apps-filter-mode">Filter Mode: Contains</p>
                    </th>
                  ))}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, visibleColumns.length)} className="py-8 text-center text-[13px] text-[var(--text-muted)]">
                    No applications match these column filters.
                  </td>
                </tr>
              ) : (
                visible.map((item) => (
                  <tr
                    key={item.id}
                    className="interactive-row"
                    onClick={() => void openView(item)}
                  >
                    {visibleColumns.map((column) => (
                      <ApplicationCell key={`${item.id}-${column}`} item={item} column={column} />
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing ? (
        <ApplicationDetailModal
          application={viewing}
          loading={detailLoading}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </section>
  )
}
