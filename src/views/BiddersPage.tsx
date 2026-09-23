import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  BidderWeeklyWorkStatusResponse,
  CandidateProfile,
  MemberDetail,
  User,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { FunLoader } from '../ui/loading/fun-loader'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { LoginPasswordPanel } from '../ui/login-password'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'
import { DEFAULT_MEMBER_PASSWORD } from '../ui/roles'
import {
  buildBidderReport,
  candidateFullName,
  type BidderReportRow,
} from '../ui/bidder-report'
import { formatRangeLabel, parseLocalDate } from '../ui/reporting-period'

type WorkPeriod = 'current' | 'previous' | 'days14' | 'days30'
type WorkSort = 'apps' | 'interviews' | 'name'

const WORK_PERIODS: Array<{ id: WorkPeriod; label: string }> = [
  { id: 'current', label: 'This Week' },
  { id: 'previous', label: 'Last Week' },
  { id: 'days14', label: '2 Weeks' },
  { id: 'days30', label: '30 Days' },
]

function weekdayShort(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).toLocaleDateString('en-US', {
    weekday: 'short',
  })
}

function dayNumber(iso: string) {
  return parseLocalDate(iso.slice(0, 10)).getDate()
}

function DayCell({
  applications,
  interviews,
  emphasis = false,
}: {
  applications: number
  interviews: number
  emphasis?: boolean
}) {
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

export function BiddersPage() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const isAdmin = user?.role === 'ADMIN'
  const isStaff = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const [bidders, setBidders] = useState<User[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [weekWork, setWeekWork] = useState<BidderWeeklyWorkStatusResponse | null>(
    null,
  )
  const [workPeriod, setWorkPeriod] = useState<WorkPeriod>('current')
  const [workSort, setWorkSort] = useState<WorkSort>('apps')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState(DEFAULT_MEMBER_PASSWORD)
  const [useDefaultPassword, setUseDefaultPassword] = useState(true)
  const [creating, setCreating] = useState(false)
  const [assignProfileId, setAssignProfileId] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [passwordRefresh, setPasswordRefresh] = useState(0)

  async function load(period = workPeriod) {
    const requests: [
      Promise<{ data: User[] }>,
      Promise<{ data: CandidateProfile[] } | null>,
      Promise<{ data: BidderWeeklyWorkStatusResponse }>,
    ] = [
      api.get<User[]>('/users/bidders'),
      isStaff
        ? api.get<CandidateProfile[]>('/bidder-profiles')
        : Promise.resolve(null),
      api.get<BidderWeeklyWorkStatusResponse>(
        '/daily-submissions/weekly-work-status',
        { params: { period } },
      ),
    ]
    const [bidderRes, profileRes, workRes] = await Promise.all(requests)
    setBidders(bidderRes.data)
    setProfiles(profileRes?.data ?? [])
    setWeekWork(workRes.data)
  }

  useEffect(() => {
    setLoading(true)
    load(workPeriod)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [workPeriod, isStaff])

  const rows = useMemo(
    () => buildBidderReport(bidders, profiles, []),
    [bidders, profiles],
  )
  const workByBidder = useMemo(() => {
    const map = new Map<
      number,
      {
        applications: number
        interviews: number
        confirmedDays: number
        days: Array<{
          reportingDate: string
          applications: number
          interviews: number
        }>
      }
    >()
    const periodDays = weekWork?.days ?? []
    for (const row of weekWork?.bidders ?? []) {
      const dayMap = new Map(
        (row.days ?? []).map((day) => [day.reportingDate.slice(0, 10), day]),
      )
      map.set(row.bidderId, {
        applications: row.applications,
        interviews: row.interviews,
        confirmedDays: row.confirmedDays,
        days: periodDays.map((date) => {
          const day = dayMap.get(date)
          return {
            reportingDate: date,
            applications: day?.applications ?? 0,
            interviews: day?.interviews ?? 0,
          }
        }),
      })
    }
    return map
  }, [weekWork])
  const workDays = weekWork?.days ?? []
  const weekLabel = useMemo(() => {
    if (!weekWork) {
      return 'This week'
    }
    const from = parseLocalDate(weekWork.periodStart)
    const toExclusive = parseLocalDate(weekWork.periodEnd)
    toExclusive.setDate(toExclusive.getDate() + 1)
    return formatRangeLabel(from, toExclusive)
  }, [weekWork])
  const trackingRows = useMemo(() => {
    const emptyDays = workDays.map((date) => ({
      reportingDate: date,
      applications: 0,
      interviews: 0,
    }))
    const list = rows.map((row) => {
      const work = workByBidder.get(row.bidder.id) ?? {
        applications: 0,
        interviews: 0,
        confirmedDays: 0,
        days: emptyDays,
      }
      return {
        bidder: row.bidder,
        applications: work.applications,
        interviews: work.interviews,
        days: work.days,
      }
    })
    return list.sort((a, b) => {
      if (workSort === 'name') {
        return a.bidder.name.localeCompare(b.bidder.name)
      }
      if (workSort === 'interviews') {
        return (
          b.interviews - a.interviews ||
          b.applications - a.applications ||
          a.bidder.name.localeCompare(b.bidder.name)
        )
      }
      return (
        b.applications - a.applications ||
        b.interviews - a.interviews ||
        a.bidder.name.localeCompare(b.bidder.name)
      )
    })
  }, [rows, workByBidder, workSort, workDays])
  const trackingTotals = useMemo(
    () =>
      trackingRows.reduce(
        (acc, row) => ({
          applications: acc.applications + row.applications,
          interviews: acc.interviews + row.interviews,
        }),
        { applications: 0, interviews: 0 },
      ),
    [trackingRows],
  )
  const dayTotals = useMemo(
    () =>
      workDays.map((date) => {
        let applications = 0
        let interviews = 0
        for (const row of trackingRows) {
          const day = row.days.find((item) => item.reportingDate === date)
          applications += day?.applications ?? 0
          interviews += day?.interviews ?? 0
        }
        return { reportingDate: date, applications, interviews }
      }),
    [workDays, trackingRows],
  )
  const selected = rows.find((row) => row.bidder.id === selectedId) ?? null
  const unassignedProfiles = profiles.filter((profile) => !profile.assignedUser)

  useEffect(() => {
    if (!selected) {
      return
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  async function onCreateBidder(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setCreating(true)
    try {
      await api.post('/users', {
        name: newName,
        email: newEmail,
        role: 'BIDDER',
        ...(useDefaultPassword
          ? { useDefaultPassword: true }
          : { password: newPassword }),
      })
      setNewName('')
      setNewEmail('')
      setNewPassword(DEFAULT_MEMBER_PASSWORD)
      setUseDefaultPassword(true)
      setCreateOpen(false)
      setNotice(
        useDefaultPassword
          ? `Bidder created. Sign-in password: ${DEFAULT_MEMBER_PASSWORD}`
          : 'Bidder created.',
      )
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  async function onAssign() {
    if (!selected || !assignProfileId) {
      return
    }
    setError('')
    setAssigning(true)
    try {
      await api.patch(`/bidder-profiles/${assignProfileId}/assignment`, {
        bidderId: selected.bidder.id,
      })
      setAssignProfileId('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setAssigning(false)
    }
  }

  function requestResetBidderPassword(bidder: User) {
    ask({
      title: `Reset ${bidder.name}'s password?`,
      description: `They will sign in with ${DEFAULT_MEMBER_PASSWORD}. Share that password with them.`,
      confirmLabel: 'Reset to this password',
      pendingLabel: 'Saving…',
      confirmTone: 'primary',
      action: async () => {
        try {
          await api.patch(`/users/${bidder.id}/password`, { useDefault: true })
          setNotice(`${bidder.name} can sign in with ${DEFAULT_MEMBER_PASSWORD}`)
          setPasswordRefresh((value) => value + 1)
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  function onDeleteBidder(bidderId: number) {
    ask({
      title: 'Delete this bidder?',
      description:
        'Assigned profiles will be unassigned. Applications and interviews stay on those profiles. Assign a profile to another member to keep working it. This cannot be undone.',
      confirmLabel: 'Delete bidder',
      action: async () => {
        setError('')
        setDeletingId(bidderId)
        try {
          await api.delete(`/users/${bidderId}`)
          if (selectedId === bidderId) {
            setSelectedId(null)
          }
          await load()
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  return (
    <section>
      {dialog}
      <PageHeader
        eyebrow={isStaff ? 'Operations' : 'Team'}
        title="Bidders"
        description={
          isStaff
            ? 'Manager-confirmed applications and interviews by bidder, plus account and profile management.'
            : 'Manager-confirmed applications and interviews by bidder, day by day.'
        }
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen((open) => !open)}>
              <Plus className="h-4 w-4" /> New bidder
            </Button>
          ) : null
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

      {isAdmin && createOpen ? (
        <form
          onSubmit={onCreateBidder}
          className="mt-5 max-w-xl rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4"
        >
          <h2 className="text-base font-semibold">Create bidder user</h2>
          <label className="mt-3 block text-sm">
            <span className="text-[var(--text-secondary)]">Name</span>
            <input
              className="input-field"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 block text-sm">
            <span className="text-[var(--text-secondary)]">Email</span>
            <input
              className="input-field"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useDefaultPassword}
              onChange={(e) => {
                const checked = e.target.checked
                setUseDefaultPassword(checked)
                if (checked) {
                  setNewPassword(DEFAULT_MEMBER_PASSWORD)
                }
              }}
            />
            <span className="text-[var(--text-secondary)]">
              Use default password ({DEFAULT_MEMBER_PASSWORD})
            </span>
          </label>
          {useDefaultPassword ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              They will sign in with{' '}
              <span className="font-mono font-medium">{DEFAULT_MEMBER_PASSWORD}</span>.
            </p>
          ) : (
            <label className="mt-3 block text-sm">
              <span className="text-[var(--text-secondary)]">Password</span>
              <input
                className="input-field"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <FunLoader label="Loading bidders" />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No bidder users yet." />
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Work status
                </h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {weekLabel} · {trackingRows.length} bidder
                  {trackingRows.length === 1 ? '' : 's'} · manager confirmed
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-[rgba(96,165,250,0.28)] bg-[rgba(59,130,246,0.12)] px-2.5 py-1 text-xs font-medium text-[#9cc6f8]">
                    {trackingTotals.applications.toLocaleString()} applications
                  </span>
                  <span className="inline-flex items-center rounded-full border border-[rgba(215,169,93,0.28)] bg-[rgba(215,169,93,0.12)] px-2.5 py-1 text-xs font-medium text-[#ddb46e]">
                    {trackingTotals.interviews.toLocaleString()} interviews
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <div className="flex flex-wrap justify-end gap-1">
                  {WORK_PERIODS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                        workPeriod === option.id
                          ? 'bg-white/[0.1] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-secondary)]'
                      }`}
                      onClick={() => setWorkPeriod(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {(
                    [
                      { id: 'apps', label: 'By apps' },
                      { id: 'interviews', label: 'By interviews' },
                      { id: 'name', label: 'By name' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase transition ${
                        workSort === option.id
                          ? 'bg-[var(--accent)] text-[#111214]'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-secondary)]'
                      }`}
                      onClick={() => setWorkSort(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    <th className="sticky left-0 z-10 bg-[var(--bg-glass-solid)] py-2 pr-3 font-semibold">
                      Bidder
                    </th>
                    {workDays.map((date) => (
                      <th
                        key={date}
                        className="min-w-[72px] px-1.5 py-2 text-center font-semibold"
                      >
                        <span className="block">{weekdayShort(date)}</span>
                        <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal text-[var(--text-muted)]">
                          {dayNumber(date)}
                        </span>
                      </th>
                    ))}
                    <th className="min-w-[72px] px-1.5 py-2 text-center font-semibold">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trackingRows.map((row) => (
                    <tr
                      key={row.bidder.id}
                      className="border-b border-[var(--border-subtle)] last:border-b-0"
                    >
                      <td className="sticky left-0 z-10 bg-[var(--bg-glass-solid)] py-3 pr-3">
                        {isStaff ? (
                          <button
                            type="button"
                            className="flex min-w-0 items-center gap-2.5 text-left"
                            onClick={() => setSelectedId(row.bidder.id)}
                          >
                            <EntityAvatar
                              name={row.bidder.name}
                              src={row.bidder.avatarUrl}
                              size="sm"
                            />
                            <span className="truncate font-medium text-[var(--text-primary)]">
                              {row.bidder.name}
                            </span>
                          </button>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2.5">
                            <EntityAvatar
                              name={row.bidder.name}
                              src={row.bidder.avatarUrl}
                              size="sm"
                            />
                            <span className="truncate font-medium text-[var(--text-primary)]">
                              {row.bidder.name}
                            </span>
                          </div>
                        )}
                      </td>
                      {row.days.map((day) => (
                        <td
                          key={day.reportingDate}
                          className="px-1.5 py-3 text-center align-middle"
                        >
                          <DayCell
                            applications={day.applications}
                            interviews={day.interviews}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-3 text-center align-middle">
                        <DayCell
                          applications={row.applications}
                          interviews={row.interviews}
                          emphasis
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {workDays.length > 0 ? (
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
                          <DayCell
                            applications={day.applications}
                            interviews={day.interviews}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-3 text-center align-middle">
                        <DayCell
                          applications={trackingTotals.applications}
                          interviews={trackingTotals.interviews}
                          emphasis
                        />
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
            <p className="mt-3 text-[11px] text-[var(--text-muted)]">
              Each day shows{' '}
              <span className="font-medium text-[#9cc6f8]">applications</span>
              {' / '}
              <span className="font-medium text-[#ddb46e]">interviews</span>
              {' '}from manager-confirmed daily reports.
            </p>
          </section>

          {isStaff ? (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <BidderCard
                  key={row.bidder.id}
                  row={row}
                  canDelete={isAdmin}
                  deleting={deletingId === row.bidder.id}
                  onDelete={() => onDeleteBidder(row.bidder.id)}
                  onSelect={() => setSelectedId(row.bidder.id)}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      {isStaff && selected ? (
        <BidderDetailModal
          row={selected}
          isAdmin={isAdmin}
          unassignedProfiles={unassignedProfiles}
          assignProfileId={assignProfileId}
          assigning={assigning}
          deleting={deletingId === selected.bidder.id}
          onClose={() => {
            setSelectedId(null)
            setAssignProfileId('')
          }}
          onAssignProfileId={setAssignProfileId}
          onAssign={() => void onAssign()}
          onDelete={isAdmin ? () => onDeleteBidder(selected.bidder.id) : undefined}
          onResetPassword={
            isAdmin ? () => requestResetBidderPassword(selected.bidder) : undefined
          }
          passwordRefresh={passwordRefresh}
        />
      ) : null}
    </section>
  )
}

function BidderCard({
  row,
  onSelect,
  canDelete,
  deleting,
  onDelete,
}: {
  row: BidderReportRow
  onSelect: () => void
  canDelete?: boolean
  deleting?: boolean
  onDelete?: () => void
}) {
  const preview = row.candidates.slice(0, 3)
  const extra = row.candidates.length - preview.length
  return (
    <article
      className="glass-clickable cursor-pointer rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-3.5"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <EntityAvatar name={row.bidder.name} src={row.bidder.avatarUrl} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-[var(--text-primary)]">
            {row.bidder.name}
          </h2>
          <p className="truncate text-sm text-[var(--text-secondary)]">{row.bidder.email}</p>
          <div className="mt-2">
            <StatusBadge muted={!row.bidder.isActive}>
              {row.bidder.isActive ? 'Active' : 'Inactive'}
            </StatusBadge>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            variant="ghost"
            className="shrink-0 !px-2 !py-1 text-xs"
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
          >
            View
          </Button>
          {canDelete && onDelete ? (
            <Button
              variant="danger"
              className="!px-2 !py-1 text-xs"
              disabled={deleting}
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
        Assigned profiles
      </p>
      {row.candidates.length === 0 ? (
        <StatusBadge muted>Unassigned</StatusBadge>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {preview.map((profile) => (
            <span
              key={profile.id}
              className="inline-flex items-center gap-1 text-sm text-[var(--text-primary)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              {profile.profileName}
            </span>
          ))}
          {extra > 0 ? (
            <p className="text-xs text-[var(--text-muted)]">+ {extra} more</p>
          ) : null}
        </div>
      )}
    </article>
  )
}

function BidderDetailModal({
  row,
  isAdmin,
  unassignedProfiles,
  assignProfileId,
  assigning,
  onAssignProfileId,
  onAssign,
  onClose,
  onDelete,
  onResetPassword,
  deleting,
  passwordRefresh = 0,
}: {
  row: BidderReportRow
  isAdmin: boolean
  unassignedProfiles: CandidateProfile[]
  assignProfileId: string
  assigning: boolean
  onAssignProfileId: (value: string) => void
  onAssign: () => void
  onClose: () => void
  onDelete?: () => void
  onResetPassword?: () => void
  deleting?: boolean
  passwordRefresh?: number
}) {
  const [signInPassword, setSignInPassword] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) {
      return
    }
    let cancelled = false
    api
      .get<MemberDetail>(`/users/${row.bidder.id}`)
      .then(({ data }) => {
        if (!cancelled) {
          setSignInPassword(data.signInPassword)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignInPassword(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, row.bidder.id, passwordRefresh])

  return (
    <div className="apps-modal" onClick={onClose} role="presentation">
      <div
        className="apps-modal-panel max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bidder-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="apps-modal-head">
          <div className="flex min-w-0 items-start gap-3">
            <EntityAvatar name={row.bidder.name} src={row.bidder.avatarUrl} size="lg" />
            <div className="min-w-0">
              <h2
                id="bidder-detail-title"
                className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]"
              >
                {row.bidder.name}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{row.bidder.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge muted={!row.bidder.isActive}>
                  {row.bidder.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
                <span className="text-[13px] text-[var(--text-muted)]">
                  Joined {new Date(row.bidder.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 overflow-auto px-5 py-4">
          {isAdmin ? (
            <LoginPasswordPanel
              personName={row.bidder.name}
              password={signInPassword}
              onApplyDefault={onResetPassword}
            />
          ) : null}

          <h3 className="mt-5 text-sm font-semibold">Assigned profiles</h3>
          {row.candidates.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No profiles are currently assigned to this bidder.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-white/10">
              {row.candidates.map((profile) => (
                <li key={profile.id} className="flex items-center gap-3 py-2">
                  <EntityAvatar
                    name={candidateFullName(profile) || profile.profileName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {profile.profileName}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {candidateFullName(profile) || 'Name not completed'}
                    </p>
                  </div>
                  <StatusBadge>Assigned</StatusBadge>
                </li>
              ))}
            </ul>
          )}

          {isAdmin ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                className="input-field mt-0 max-w-xs"
                value={assignProfileId}
                onChange={(e) => onAssignProfileId(e.target.value)}
              >
                <option value="">Assign unassigned profile</option>
                {unassignedProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profileName}
                  </option>
                ))}
              </select>
              <Button disabled={!assignProfileId || assigning} onClick={onAssign}>
                {assigning ? 'Saving…' : 'Assign'}
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              Reassignment is managed by an administrator.
            </p>
          )}

          {onDelete ? (
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
              <Button variant="danger" disabled={deleting} onClick={onDelete}>
                {deleting ? 'Deleting…' : 'Delete bidder'}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
