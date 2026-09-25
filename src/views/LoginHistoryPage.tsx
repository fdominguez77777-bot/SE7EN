'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  History,
  Laptop,
  MapPin,
  RefreshCw,
  Search,
  Smartphone,
  Users,
} from 'lucide-react'
import { Navigate } from '@/lib/navigation'

import { api, getApiErrorMessage } from '../api/client'
import type { LoginHistoryListResponse, LoginHistoryRow, Role } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button, SectionCard } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { FunLoader } from '../ui/loading/fun-loader'
import { PageHeader } from '../ui/page-header'
import { ROLE_LABEL, roleBadgeTone } from '../ui/roles'
import { StatusBadge } from '../ui/StatusBadge'

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  if (totalMinutes < 1) return '<1m'
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}

function formatWhen(iso: string) {
  const date = new Date(iso)
  return {
    date: date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  }
}

function relativeLabel(iso: string) {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return formatWhen(iso).time
}

function dayKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function shiftDay(key: string, delta: number) {
  const date = parseDayKey(key)
  date.setDate(date.getDate() + delta)
  return dayKey(date)
}

function dayTitle(key: string, todayKey: string) {
  const long = parseDayKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  if (key === todayKey) return `Today · ${long}`
  if (key === shiftDay(todayKey, -1)) return `Yesterday · ${long}`
  return long
}

export function LoginHistoryPage() {
  const { user } = useAuth()
  const todayKey = dayKey(new Date())
  const [day, setDay] = useState(todayKey)
  const [data, setData] = useState<LoginHistoryListResponse | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const isToday = day === todayKey

  const load = useCallback(
    async (soft = false) => {
      if (soft) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError('')
      try {
        const from = parseDayKey(day)
        const to = parseDayKey(shiftDay(day, 1))
        const { data: payload } = await api.get<LoginHistoryListResponse>(
          '/login-history',
          { params: { from: from.toISOString(), to: to.toISOString() } },
        )
        setData(payload)
      } catch (err) {
        setError(getApiErrorMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [day],
  )

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.items ?? []).filter((row) => {
      if (roleFilter !== 'all' && row.role !== roleFilter) {
        return false
      }
      if (!needle) {
        return true
      }
      return (
        row.displayName.toLowerCase().includes(needle) ||
        row.username.toLowerCase().includes(needle) ||
        row.ipAddress.toLowerCase().includes(needle) ||
        row.location.toLowerCase().includes(needle) ||
        row.deviceSummary.toLowerCase().includes(needle)
      )
    })
  }, [data, query, roleFilter])

  if (user && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return (
    <section className="lh-page">
      <PageHeader
        eyebrow="Security"
        title="Login history"
        description="Platform visits — when members open SE7EN, how long they stay, plus IP, region, and device."
        actions={
          <Button
            variant="secondary"
            disabled={loading || refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="lh-daybar glass-card mt-6">
        <div className="lh-daybar-nav">
          <button
            type="button"
            className="lh-daybar-btn"
            onClick={() => setDay((key) => shiftDay(key, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            className="input-field lh-daybar-date"
            value={day}
            max={todayKey}
            onChange={(e) => {
              if (e.target.value) setDay(e.target.value)
            }}
            aria-label="Select day"
          />
          <button
            type="button"
            className="lh-daybar-btn"
            onClick={() => setDay((key) => shiftDay(key, 1))}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="lh-daybar-title">{dayTitle(day, todayKey)}</p>
        {!isToday ? (
          <Button variant="secondary" onClick={() => setDay(todayKey)}>
            Today
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8">
          <FunLoader label="Loading login history" />
        </div>
      ) : (
        <>
          <div className="lh-stats mt-6">
            <Stat
              icon={History}
              label="Visits"
              value={data?.summary.total ?? 0}
              hint={isToday ? 'Opened today' : 'Opened this day'}
            />
            <Stat
              icon={Users}
              label="Members"
              value={data?.summary.uniqueUsers ?? 0}
              hint="Signed in this day"
            />
            <Stat
              icon={Clock3}
              label="Time on platform"
              value={formatDuration(data?.summary.totalDurationMs ?? 0)}
              hint="Across all visits"
            />
            <Stat
              icon={Globe2}
              label="Countries"
              value={data?.summary.uniqueCountries ?? 0}
              hint="Visit locations"
            />
          </div>

          <SectionCard
            className="mt-6"
            title="Platform visits"
            description="Visits opened on the selected day. Duration updates while the tab stays active."
            action={
              <div className="lh-filters">
                <label className="lh-search">
                  <Search className="h-3.5 w-3.5" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search member, IP, location…"
                  />
                </label>
                <select
                  className="input-field lh-role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)}
                >
                  <option value="all">All roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="BID_MANAGER">Bid Manager</option>
                  <option value="BIDDER">Bidder</option>
                </select>
              </div>
            }
          >
            {items.length === 0 ? (
              <EmptyState
                title={data?.items.length ? 'No matching visits' : 'No visits on this day'}
                description={
                  data?.items.length
                    ? 'Try a different search or role filter.'
                    : 'Use the arrows or date picker to browse another day.'
                }
              />
            ) : (
              <div className="lh-table-wrap table-wrap">
                <table className="lh-table table-ui">
                  <thead>
                    <tr>
                      <th>Opened</th>
                      <th>Viewed</th>
                      <th>Member</th>
                      <th>Location</th>
                      <th>IP</th>
                      <th>Device</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <HistoryRow key={row.id} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </section>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof History
  label: string
  value: number | string
  hint: string
}) {
  return (
    <div className="lh-stat glass-card">
      <div className="lh-stat-icon">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="lh-stat-label">{label}</p>
        <p className="lh-stat-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="lh-stat-hint">{hint}</p>
      </div>
    </div>
  )
}

function HistoryRow({ row }: { row: LoginHistoryRow }) {
  const opened = formatWhen(row.createdAt)
  const lastSeen = formatWhen(row.lastSeenAt)
  const DeviceIcon = row.device === 'Mobile' ? Smartphone : Laptop
  return (
    <tr>
      <td>
        <div className="lh-when">
          <span className="lh-when-rel">{relativeLabel(row.createdAt)}</span>
          <span className="lh-when-abs">
            {opened.date} · {opened.time}
          </span>
        </div>
      </td>
      <td>
        <div className="lh-when">
          <span className="lh-when-rel">
            {row.active ? 'Active now' : formatDuration(row.durationMs)}
          </span>
          <span className="lh-when-abs">
            {row.active
              ? `Until ${lastSeen.time}`
              : `${lastSeen.date} · ${lastSeen.time}`}
          </span>
        </div>
      </td>
      <td>
        <div className="lh-member">
          <EntityAvatar name={row.displayName} size="sm" />
          <div className="min-w-0">
            <p className="lh-member-name">{row.displayName}</p>
            <p className="lh-member-user">@{row.username}</p>
            <div className="lh-member-role">
              <StatusBadge tone={roleBadgeTone(row.role as Role)}>
                {ROLE_LABEL[row.role as Role] ?? row.role}
              </StatusBadge>
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="lh-location">
          <MapPin className="lh-location-icon" aria-hidden="true" />
          <div className="min-w-0">
            <p className="lh-location-main">{row.location}</p>
            {row.country ? (
              <p className="lh-location-sub">{row.country}</p>
            ) : null}
          </div>
        </div>
      </td>
      <td>
        <code className="lh-ip">{row.ipAddress}</code>
      </td>
      <td>
        <div className="lh-device">
          <DeviceIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
          <span>{row.deviceSummary}</span>
        </div>
      </td>
    </tr>
  )
}
