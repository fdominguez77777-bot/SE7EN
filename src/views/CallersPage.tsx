import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'
import {
  Briefcase,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  GraduationCap,
  Headset,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Send,
  UsersRound,
  X,
} from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { AssignableProfile, Caller, CallerProfileDetail } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { FunLoader } from '../ui/loading/fun-loader'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'

type ProfileFilter = 'all' | 'assigned' | 'available'

const FILTERS: Array<{ id: ProfileFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'available', label: 'Not assigned' },
]

function sameIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id) => right.includes(id))
}

function matches(needle: string, ...values: Array<string | null | undefined>) {
  const key = needle.trim().toLowerCase()
  return !key || values.some((value) => (value ?? '').toLowerCase().includes(key))
}

function formatAssigned(value: string | null) {
  if (!value) {
    return null
  }
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function CallersPage() {
  const { user } = useAuth()
  return user?.role === 'CALLER' ? <MyProfilesView /> : <ManageCallersView />
}

function ManageCallersView() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const [callers, setCallers] = useState<Caller[]>([])
  const [profiles, setProfiles] = useState<AssignableProfile[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState<number[]>([])
  const [callerQuery, setCallerQuery] = useState('')
  const [profileQuery, setProfileQuery] = useState('')
  const [filter, setFilter] = useState<ProfileFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const [{ data: callerRows }, { data: profileRows }] = await Promise.all([
      api.get<Caller[]>('/callers'),
      api.get<AssignableProfile[]>('/callers/profiles'),
    ])
    setCallers(callerRows)
    setProfiles(profileRows)
    return callerRows
  }

  useEffect(() => {
    load()
      .then((rows) => {
        const first = rows.find((row) => row.isActive) ?? rows[0]
        if (first) {
          setSelectedId(first.id)
          setDraft(first.profiles.map((profile) => profile.id))
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const selected = callers.find((row) => row.id === selectedId) ?? null
  const savedIds = useMemo(
    () => selected?.profiles.map((profile) => profile.id) ?? [],
    [selected],
  )
  const dirty = Boolean(selected) && !sameIds(draft, savedIds)
  const added = draft.filter((id) => !savedIds.includes(id)).length
  const removed = savedIds.filter((id) => !draft.includes(id)).length

  const visibleCallers = callers.filter((row) => matches(callerQuery, row.name, row.email))
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  )
  const draftProfiles = draft
    .map((id) => profileById.get(id))
    .filter((row): row is AssignableProfile => Boolean(row))
    .sort((left, right) => left.profileName.localeCompare(right.profileName))
  const visibleProfiles = profiles.filter((profile) => {
    const on = draft.includes(profile.id)
    if (filter === 'assigned' && !on) {
      return false
    }
    if (filter === 'available' && on) {
      return false
    }
    return matches(profileQuery, profile.profileName, profile.fullName, profile.email)
  })

  const assignedTotal = callers.reduce((sum, row) => sum + row.profiles.length, 0)
  const waiting = callers.filter((row) => row.isActive && row.profiles.length === 0).length

  function pick(caller: Caller) {
    if (caller.id === selectedId) {
      return
    }
    const open = () => {
      setSelectedId(caller.id)
      setDraft(caller.profiles.map((profile) => profile.id))
      setProfileQuery('')
      setFilter('all')
      setNotice('')
    }
    if (!dirty) {
      open()
      return
    }
    ask({
      title: 'Discard unsaved changes?',
      description: `Your profile changes for ${selected?.name ?? 'this caller'} have not been saved.`,
      confirmLabel: 'Discard',
      action: async () => open(),
    })
  }

  function toggle(id: number) {
    setNotice('')
    setDraft((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    )
  }

  function selectShown() {
    setNotice('')
    setDraft((current) => [
      ...new Set([...current, ...visibleProfiles.map((profile) => profile.id)]),
    ])
  }

  function clearShown() {
    setNotice('')
    const shown = new Set(visibleProfiles.map((profile) => profile.id))
    setDraft((current) => current.filter((id) => !shown.has(id)))
  }

  async function save() {
    if (!selected) {
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.put<Caller>(`/callers/${selected.id}/profiles`, {
        profileIds: draft,
      })
      setCallers((current) => current.map((row) => (row.id === data.id ? data : row)))
      setDraft(data.profiles.map((profile) => profile.id))
      const { data: profileRows } = await api.get<AssignableProfile[]>('/callers/profiles')
      setProfiles(profileRows)
      setNotice(
        `${data.name} can now see ${plural(data.profiles.length, 'profile')}. Changes apply on their next refresh.`,
      )
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function refresh() {
    setError('')
    try {
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <section>
      {dialog}
      <PageHeader
        eyebrow="Operations"
        title="Callers"
        description="Choose which profiles each caller works. A caller only sees interview schedules and applications for the profiles assigned to them."
        actions={
          <Button variant="secondary" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Callers" value={callers.filter((row) => row.isActive).length} />
        <Stat label="Profile assignments" value={assignedTotal} />
        <Stat
          label="Waiting for profiles"
          value={waiting}
          tone={waiting > 0 ? 'warning' : undefined}
        />
      </div>

      {loading ? (
        <div className="glass-panel mt-4 px-5 py-8">
          <FunLoader label="Loading callers" />
        </div>
      ) : callers.length === 0 ? (
        <div className="glass-panel mt-4 px-5 py-8">
          <EmptyState
            icon={Headset}
            title="No callers yet"
            description="Add a member with the Caller role, then come back to assign their profiles."
            action={
              user?.role === 'ADMIN' ? (
                <Link
                  to="/admin/members"
                  className="text-[13px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  Go to Members →
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="glass-panel flex min-h-0 flex-col px-3 py-3 lg:max-h-[calc(100vh-230px)]">
            <label className="input-with-icon">
              <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                className="input-field mt-0"
                placeholder="Search callers"
                value={callerQuery}
                onChange={(event) => setCallerQuery(event.target.value)}
              />
            </label>
            <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto" role="listbox" aria-label="Callers">
              {visibleCallers.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-[var(--text-muted)]">
                  No callers match “{callerQuery}”.
                </li>
              ) : (
                visibleCallers.map((caller) => {
                  const on = caller.id === selectedId
                  return (
                    <li key={caller.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onClick={() => pick(caller)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          on
                            ? 'border-[var(--accent)]/40 bg-white/[0.06]'
                            : 'border-transparent hover:bg-white/[0.04]'
                        }`}
                      >
                        <EntityAvatar name={caller.name} src={caller.avatarUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                            {caller.name}
                          </span>
                          <span className="block truncate text-xs text-[var(--text-muted)]">
                            {caller.email}
                          </span>
                        </span>
                        {!caller.isActive ? (
                          <StatusBadge muted>Inactive</StatusBadge>
                        ) : caller.profiles.length === 0 ? (
                          <StatusBadge tone="warning">None</StatusBadge>
                        ) : (
                          <StatusBadge>{String(caller.profiles.length)}</StatusBadge>
                        )}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </aside>

          {selected ? (
            <div className="glass-panel flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-glass)] px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <EntityAvatar name={selected.name} src={selected.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-[var(--text-primary)]">
                        {selected.name}
                      </h2>
                      {selected.isActive ? null : <StatusBadge muted>Inactive</StatusBadge>}
                    </div>
                    <p className="truncate text-sm text-[var(--text-muted)]">{selected.email}</p>
                  </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="num-metric font-semibold text-[var(--text-primary)]">
                    {draft.length}
                  </span>{' '}
                  of {plural(profiles.length, 'profile')} assigned
                </p>
              </div>

              <div className="border-b border-[var(--border-glass)] px-5 py-4">
                <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
                  Assigned profiles
                </p>
                {draftProfiles.length === 0 ? (
                  <p className="mt-2 rounded-lg border border-dashed border-[var(--border-glass)] px-3 py-3 text-sm text-[var(--text-muted)]">
                    No profiles yet. Pick profiles below. Until then this caller sees no interviews or applications.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {draftProfiles.map((profile) => (
                      <span
                        key={profile.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1 pr-1 pl-3 text-[13px] text-[var(--text-primary)]"
                      >
                        {profile.profileName}
                        <button
                          type="button"
                          className="rounded-full p-0.5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                          aria-label={`Remove ${profile.profileName}`}
                          onClick={() => toggle(profile.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
                <label className="input-with-icon min-w-[220px] flex-1">
                  <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                  <input
                    className="input-field mt-0"
                    placeholder="Search profiles by name or email"
                    value={profileQuery}
                    onChange={(event) => setProfileQuery(event.target.value)}
                  />
                </label>
                <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5" role="tablist">
                  {FILTERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={filter === item.id}
                      onClick={() => setFilter(item.id)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        filter === item.id
                          ? 'bg-white/10 text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-5 pt-2 text-xs text-[var(--text-muted)]">
                <span>{plural(visibleProfiles.length, 'profile')} shown</span>
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="hover:text-[var(--text-primary)] disabled:opacity-40"
                    disabled={visibleProfiles.length === 0}
                    onClick={selectShown}
                  >
                    Select shown
                  </button>
                  <button
                    type="button"
                    className="hover:text-[var(--text-primary)] disabled:opacity-40"
                    disabled={visibleProfiles.length === 0}
                    onClick={clearShown}
                  >
                    Clear shown
                  </button>
                </span>
              </div>

              <ul className="mt-2 max-h-[420px] flex-1 overflow-y-auto px-3 pb-3">
                {profiles.length === 0 ? (
                  <li className="px-2 py-8">
                    <EmptyState
                      icon={UsersRound}
                      title="No profiles yet"
                      description="Create profiles on the Profiles page first."
                    />
                  </li>
                ) : visibleProfiles.length === 0 ? (
                  <li className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
                    No profiles match this search.
                  </li>
                ) : (
                  visibleProfiles.map((profile) => {
                    const on = draft.includes(profile.id)
                    const others = profile.callerIds.filter((id) => id !== selected.id).length
                    return (
                      <li key={profile.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors ${
                            on ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={() => toggle(profile.id)}
                          />
                          <span
                            aria-hidden="true"
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              on
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-[#111214]'
                                : 'border-white/25'
                            }`}
                          >
                            {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                              {profile.profileName}
                            </span>
                            <span className="block truncate text-xs text-[var(--text-muted)]">
                              {[profile.fullName, profile.email].filter(Boolean).join(' · ') ||
                                'No name or email on file'}
                            </span>
                          </span>
                          {profile.status && profile.status !== 'ACTIVE' ? (
                            <StatusBadge muted>{profile.status.toLowerCase()}</StatusBadge>
                          ) : null}
                          {others > 0 ? (
                            <span className="hidden shrink-0 text-xs text-[var(--text-muted)] sm:inline">
                              Also with {plural(others, 'caller')}
                            </span>
                          ) : null}
                        </label>
                      </li>
                    )
                  })
                )}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-glass)] px-5 py-3">
                <p className="text-sm text-[var(--text-secondary)]">
                  {dirty
                    ? [added ? `${added} to add` : '', removed ? `${removed} to remove` : '']
                        .filter(Boolean)
                        .join(' · ')
                    : notice || 'All changes saved.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={!dirty || saving}
                    onClick={() => setDraft(savedIds)}
                  >
                    Discard
                  </Button>
                  <Button disabled={!dirty || saving} onClick={() => void save()}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel px-5 py-10">
              <EmptyState
                icon={Headset}
                title="Select a caller"
                description="Pick a caller on the left to manage their profiles."
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function MyProfilesView() {
  const [me, setMe] = useState<MyCaller | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)

  useEffect(() => {
    api
      .get<MyCaller>('/callers/me')
      .then(({ data }) => {
        setMe(data)
        setActiveId(data.profiles[0]?.id ?? null)
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const profiles = me?.profiles ?? []
  const active = profiles.find((row) => row.id === activeId) ?? profiles[0] ?? null

  return (
    <section>
      <PageHeader
        eyebrow="Caller"
        title="My profiles"
        description="These are the profiles assigned to you. Your interview schedule and applications only include these profiles."
        actions={
          profiles.length > 0 ? (
            <div className="flex gap-2">
              <Link
                to="/interviews"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1c21] px-3 py-2 text-sm text-[#d8d9dc] hover:bg-[#22252b]"
              >
                <CalendarClock className="h-4 w-4" />
                Schedules
              </Link>
              <Link
                to="/applications"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1a1c21] px-3 py-2 text-sm text-[#d8d9dc] hover:bg-[#22252b]"
              >
                <Send className="h-4 w-4" />
                Applications
              </Link>
            </div>
          ) : undefined
        }
      />

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="glass-panel mt-5 px-5 py-8">
          <FunLoader label="Loading your profiles" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="glass-panel mt-5 px-5 py-10">
          <EmptyState
            icon={Headset}
            title="No profiles assigned yet"
            description="Ask your manager to assign profiles to you. Their interviews and applications will show up here once they do."
          />
        </div>
      ) : (
        <>
          {profiles.length > 1 ? (
            <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Your profiles">
              {profiles.map((profile) => {
                const on = profile.id === active?.id
                return (
                  <button
                    key={profile.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActiveId(profile.id)}
                    className={`inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors ${
                      on
                        ? 'border-[var(--accent)]/50 bg-white/[0.07] text-[var(--text-primary)]'
                        : 'border-white/10 text-[var(--text-secondary)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <EntityAvatar name={profile.fullName || profile.profileName} size="sm" />
                    {profile.profileName}
                  </button>
                )
              })}
            </div>
          ) : null}
          {active ? <ProfileSheet key={active.id} profile={active} /> : null}
        </>
      )}
    </section>
  )
}

type MyCaller = Omit<Caller, 'profiles'> & { profiles: CallerProfileDetail[] }

const LIST_PREVIEW = 3

function monthYear(value: string | null) {
  if (!value) {
    return ''
  }
  const [year, month] = value.split('-').map(Number)
  if (!year) {
    return value
  }
  if (!month) {
    return String(year)
  }
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

function dateSpan(start: string | null, end: string | null, current = false) {
  const from = monthYear(start)
  const to = current ? 'Present' : monthYear(end)
  if (!from && !to) {
    return ''
  }
  return `${from || '—'} – ${to || '—'}`
}

function ProfileSheet({ profile }: { profile: CallerProfileDetail }) {
  const links = [
    { label: 'LinkedIn', href: safeLink(profile.linkedinUrl) },
    { label: 'GitHub', href: safeLink(profile.githubUrl) },
    { label: 'Portfolio', href: safeLink(profile.portfolioUrl) },
  ].filter((row): row is { label: string; href: string } => Boolean(row.href))
  const current = profile.experiences.find((row) => row.current) ?? profile.experiences[0]
  const assigned = formatAssigned(profile.assignedAt)

  return (
    <article className="glass-panel mt-4 overflow-hidden">
      <header className="flex flex-wrap items-center gap-4 border-b border-[var(--border-glass)] px-5 py-4">
        <EntityAvatar name={profile.fullName || profile.profileName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {profile.profileName}
            </h2>
            {profile.status && profile.status !== 'ACTIVE' ? (
              <StatusBadge muted>{profile.status.toLowerCase()}</StatusBadge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-sm text-[var(--text-secondary)]">
            {[
              profile.fullName !== profile.profileName ? profile.fullName : '',
              current ? [current.role, current.companyName].filter(Boolean).join(' at ') : '',
            ]
              .filter(Boolean)
              .join(' · ') || 'No headline on file'}
          </p>
        </div>
        {assigned ? (
          <p className="text-xs text-[var(--text-muted)]">Assigned {assigned}</p>
        ) : null}
      </header>

      <dl className="grid grid-cols-1 gap-px bg-[var(--border-glass)] sm:grid-cols-3">
        <Fact icon={Mail} label="Gmail" value={profile.email} copyable />
        <Fact icon={Phone} label="Phone" value={profile.phone} copyable />
        <Fact icon={MapPin} label="Location" value={profile.location} />
      </dl>

      {links.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border-glass)] px-5 py-3">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-px border-t border-[var(--border-glass)] bg-[var(--border-glass)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Timeline
          icon={Briefcase}
          title="Experience"
          empty="No work experience on file."
          rows={profile.experiences.map((row) => ({
            title: row.companyName,
            subtitle: [row.role, row.location].filter(Boolean).join(' · '),
            when: dateSpan(row.startDate, row.endDate, row.current),
            highlight: row.current,
          }))}
        />
        <Timeline
          icon={GraduationCap}
          title="Education"
          empty="No education on file."
          rows={profile.educations.map((row) => ({
            title: row.institutionName,
            subtitle: row.degree ?? '',
            when: dateSpan(row.fromDate, row.toDate),
            highlight: false,
          }))}
        />
      </div>
    </article>
  )
}

function safeLink(value: string | null) {
  const raw = value?.trim()
  if (!raw) {
    return null
  }
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(url).toString()
  } catch {
    return null
  }
}

function Fact({
  icon: Icon,
  label,
  value,
  copyable = false,
}: {
  icon: typeof Mail
  label: string
  value: string | null
  copyable?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) {
      return
    }
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--bg-glass-solid)] px-5 py-3">
      <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
          {label}
        </dt>
        <dd
          className={`truncate text-sm ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
          title={value ?? undefined}
        >
          {value || 'Not on file'}
        </dd>
      </div>
      {copyable && value ? (
        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
          aria-label={`Copy ${label.toLowerCase()}`}
          onClick={() => void copy()}
        >
          {copied ? <Check className="h-4 w-4 text-[#83c99c]" /> : <Copy className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  )
}

function Timeline({
  icon: Icon,
  title,
  empty,
  rows,
}: {
  icon: typeof Briefcase
  title: string
  empty: string
  rows: Array<{ title: string; subtitle: string; when: string; highlight: boolean }>
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? rows : rows.slice(0, LIST_PREVIEW)
  const hidden = rows.length - shown.length

  return (
    <section className="bg-[var(--bg-glass-solid)] px-5 py-4">
      <h3 className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
        {rows.length > 0 ? <span className="normal-case">· {rows.length}</span> : null}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-2.5">
          {shown.map((row, index) => (
            <li key={`${row.title}-${index}`} className="flex items-baseline gap-3">
              <span
                aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 self-start rounded-full ${
                  row.highlight ? 'bg-[var(--accent)]' : 'bg-white/25'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{row.title}</p>
                {row.subtitle ? (
                  <p className="truncate text-xs text-[var(--text-secondary)]">{row.subtitle}</p>
                ) : null}
              </div>
              {row.when ? (
                <span className="shrink-0 text-xs whitespace-nowrap text-[var(--text-muted)]">
                  {row.when}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {rows.length > LIST_PREVIEW ? (
        <button
          type="button"
          className="mt-3 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Show less' : `Show ${hidden} more`}
        </button>
      ) : null}
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warning'
}) {
  return (
    <div className="glass-panel px-4 py-3">
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p
        className={`num-metric mt-1 text-2xl font-semibold ${
          tone === 'warning' && value > 0 ? 'text-[#ddb46e]' : 'text-[var(--text-primary)]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
