'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Globe2,
  History,
  Laptop,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
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
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatWhen(iso).date
}

export function LoginHistoryPage() {
  const { user } = useAuth()
  const [data, setData] = useState<LoginHistoryListResponse | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (soft = false) => {
    if (soft) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError('')
    try {
      const { data: payload } = await api.get<LoginHistoryListResponse>(
        '/login-history',
        { params: { limit: 200 } },
      )
      setData(payload)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

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
              label="Shown"
              value={data?.summary.total ?? 0}
              hint="Recent visits"
            />
            <Stat
              icon={Shield}
              label="Today"
              value={data?.summary.today ?? 0}
              hint={`${data?.summary.uniqueUsersToday ?? 0} member${
                (data?.summary.uniqueUsersToday ?? 0) === 1 ? '' : 's'
              }`}
            />
            <Stat
              icon={Globe2}
              label="Countries"
              value={data?.summary.uniqueCountries ?? 0}
              hint="In this list"
            />
          </div>

          <SectionCard
            className="mt-6"
            title="Platform visits"
            description="Opens when someone loads the app. Duration updates while the tab stays active."
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
                title={data?.items.length ? 'No matching visits' : 'No visits recorded yet'}
                description={
                  data?.items.length
                    ? 'Try a different search or role filter.'
                    : 'Visits appear when a member opens the platform while signed in.'
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
  value: number
  hint: string
}) {
  return (
    <div className="lh-stat glass-card">
      <div className="lh-stat-icon">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="lh-stat-label">{label}</p>
        <p className="lh-stat-value">{value.toLocaleString()}</p>
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
