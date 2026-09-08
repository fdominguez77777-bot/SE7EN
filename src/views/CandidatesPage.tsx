import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'
import { Loader2, Plus, Search } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { CandidateProfile, Education, Interview, JobApplication, User, WorkExperience } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { CardSkeleton } from '../ui/loading/page-skeletons'
import { PageHeader } from '../ui/page-header'
import { ROLE_LABEL } from '../ui/roles'
import { StatusBadge } from '../ui/StatusBadge'

const ASSIGNABLE_ROLES: Array<User['role']> = ['ADMIN', 'BID_MANAGER', 'BIDDER']
const ROLE_SORT: Record<User['role'], number> = {
  ADMIN: 0,
  BID_MANAGER: 1,
  BIDDER: 2,
}

const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Prefer not to say',
  'Other',
]

const RACE_OPTIONS = [
  'Prefer not to say',
  'White',
  'Black or African American',
  'Asian',
  'Hispanic or Latino',
  'Native American or Alaska Native',
  'Native Hawaiian or Other Pacific Islander',
  'Two or more races',
  'Other',
]

const VETERAN_OPTIONS = [
  'I am not a protected veteran',
  'I identify as a protected veteran',
  'I prefer not to answer',
]

const DISABILITY_OPTIONS = [
  'No, I do not have a disability',
  'Yes, I have a disability',
  'I do not wish to answer',
]

type JobDraft = {
  key: string
  id?: number
  companyName: string
  industry: string
  city: string
  state: string
  startDate: string
  endDate: string
  currentlyWorksHere: boolean
}

type SchoolDraft = {
  key: string
  id?: number
  institutionName: string
  degree: string
  fromDate: string
  toDate: string
}

type BasicDraft = {
  profileName: string
  firstName: string
  middleName: string
  lastName: string
  email: string
  phoneNumber: string
  gender: string
  dateOfBirth: string
  streetAddress: string
  city: string
  stateRegion: string
  zipPostalCode: string
  linkedinUrl: string
  githubUrl: string
  portfolioUrl: string
  raceEthnicity: string
  veteranStatus: string
  disabilityStatus: string
}

function emptyBasic(): BasicDraft {
  return {
    profileName: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
    streetAddress: '',
    city: '',
    stateRegion: '',
    zipPostalCode: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    raceEthnicity: '',
    veteranStatus: '',
    disabilityStatus: '',
  }
}

function basicFromProfile(profile: CandidateProfile): BasicDraft {
  return {
    profileName: profile.profileName ?? '',
    firstName: profile.firstName ?? '',
    middleName: profile.middleName ?? '',
    lastName: profile.lastName ?? '',
    email: profile.email ?? '',
    phoneNumber: profile.phoneNumber ?? '',
    gender: profile.gender ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    streetAddress: profile.streetAddress ?? '',
    city: profile.city ?? '',
    stateRegion: profile.stateRegion ?? '',
    zipPostalCode: profile.zipPostalCode ?? '',
    linkedinUrl: profile.linkedinUrl ?? '',
    githubUrl: profile.githubUrl ?? '',
    portfolioUrl: profile.portfolioUrl ?? '',
    raceEthnicity: profile.raceEthnicity ?? '',
    veteranStatus: profile.veteranStatus ?? '',
    disabilityStatus: profile.disabilityStatus ?? '',
  }
}

function jobFromRecord(job: WorkExperience): JobDraft {
  return {
    key: `job-${job.id}`,
    id: job.id,
    companyName: job.companyName,
    industry: job.industry ?? '',
    city: job.city ?? '',
    state: job.state ?? '',
    startDate: job.startDate ?? '',
    endDate: job.endDate ?? '',
    currentlyWorksHere: job.currentlyWorksHere,
  }
}

function schoolFromRecord(school: Education): SchoolDraft {
  return {
    key: `school-${school.id}`,
    id: school.id,
    institutionName: school.institutionName,
    degree: school.degree ?? '',
    fromDate: school.fromDate ?? '',
    toDate: school.toDate ?? '',
  }
}

function newJob(): JobDraft {
  return {
    key: `new-job-${crypto.randomUUID()}`,
    companyName: '',
    industry: '',
    city: '',
    state: '',
    startDate: '',
    endDate: '',
    currentlyWorksHere: false,
  }
}

function newSchool(): SchoolDraft {
  return {
    key: `new-school-${crypto.randomUUID()}`,
    institutionName: '',
    degree: '',
    fromDate: '',
    toDate: '',
  }
}

function fullName(profile: Pick<CandidateProfile, 'firstName' | 'middleName' | 'lastName'>) {
  return [profile.firstName, profile.middleName, profile.lastName]
    .filter(Boolean)
    .join(' ')
}

function formatRange(
  start: string,
  end: string,
  current?: boolean,
) {
  if (!start && !end && !current) {
    return 'Dates not set'
  }
  if (current) {
    return `${start || '—'} – Present`
  }
  return `${start || '—'} – ${end || '—'}`
}

function withCurrentOption(options: string[], current: string) {
  if (current && !options.includes(current)) {
    return [current, ...options]
  }
  return options
}

export function CandidatesPage() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const isAdmin = user?.role === 'ADMIN'
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'list' | 'editor'>('list')
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])

  async function load() {
    const [{ data }, { data: appRows }, { data: interviewRows }] = await Promise.all([
      api.get<CandidateProfile[]>('/bidder-profiles'),
      api.get<JobApplication[]>('/job-applications'),
      api.get<Interview[]>('/interviews'),
    ])
    setProfiles(data)
    setApplications(appRows)
    setInterviews(interviewRows)
    if (isAdmin) {
      const { data: userRows } = await api.get<User[]>('/users')
      setUsers(userRows)
    }
    return data
  }

  function deleteProfile(id: number) {
    ask({
      title: 'Delete this profile?',
      description:
        'Applications and interviews for this profile will also be removed. This cannot be undone.',
      confirmLabel: 'Delete profile',
      action: async () => {
        setError('')
        setDeletingId(id)
        try {
          await api.delete(`/bidder-profiles/${id}`)
          if (editingId === id) {
            setMode('list')
            setEditingId(null)
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

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) {
      return profiles
    }
    return profiles.filter((profile) => {
      const assigned = profile.assignedUser
        ? `${profile.assignedUser.name} ${profile.assignedUser.email}`
        : ''
      return [profile.profileName, fullName(profile), assigned]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [profiles, query])

  const selected =
    typeof editingId === 'number'
      ? (profiles.find((row) => row.id === editingId) ?? null)
      : null

  return (
    <section>
      {dialog}
      {error ? (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {mode === 'list' ? (
        <>
          <PageHeader
            eyebrow="Operations"
            title="Profiles"
            description="Manage profiles and member assignments."
            actions={
              isAdmin ? (
                <Button
                  onClick={() => {
                    setEditingId('new')
                    setMode('editor')
                    setError('')
                  }}
                >
                  <Plus className="h-4 w-4" /> New Profile
                </Button>
              ) : null
            }
          />

          <div className="glass-toolbar mt-5 px-3 py-2.5">
            <label className="input-with-icon">
              <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                className="input-field mt-0"
                placeholder="Search by profile, name, or assigned member"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {loading ? (
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <CardSkeleton className="h-36" />
                <CardSkeleton className="h-36" />
                <CardSkeleton className="h-36" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="No profiles found."
                  description="Create a profile to start assignment and applications."
                  action={
                    isAdmin ? (
                      <Button
                        onClick={() => {
                          setEditingId('new')
                          setMode('editor')
                        }}
                      >
                        New Profile
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((profile) => {
                  const name = fullName(profile)
                  const appCount = applications.filter(
                    (row) => row.candidateProfileId === profile.id,
                  ).length
                  const interviewCount = interviews.filter(
                    (row) => row.candidateProfileId === profile.id,
                  ).length
                  const openEditor = () => {
                    setEditingId(profile.id)
                    setMode('editor')
                    setError('')
                  }
                  return (
                    <article
                      key={profile.id}
                      className={`glass-card glass-clickable cursor-pointer px-4 py-3.5 ${
                        profile.assignedUser
                          ? ''
                          : 'border-[rgba(215,169,93,0.35)] hover:border-[rgba(215,169,93,0.5)]'
                      }`}
                      onClick={openEditor}
                    >
                      <div className="flex items-start gap-3">
                        <EntityAvatar name={name || profile.profileName} />
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-base font-semibold text-[var(--text-primary)]">
                            {name || profile.profileName}
                          </h2>
                          <p className="truncate text-sm text-[var(--text-secondary)]">
                            {name ? profile.profileName : 'Name not completed'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                        <Button
                          variant={isAdmin ? 'secondary' : 'ghost'}
                          className="shrink-0 !px-2 !py-1 text-xs"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditor()
                          }}
                        >
                          {isAdmin ? 'Edit' : 'View'}
                        </Button>
                        {isAdmin ? (
                          <Button
                            variant="danger"
                            className="!px-2 !py-1 text-xs"
                            disabled={deletingId === profile.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              deleteProfile(profile.id)
                            }}
                          >
                            {deletingId === profile.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-glass)] pt-3 text-sm">
                        <div>
                          <p className="text-[13px] text-[var(--text-secondary)]">Assigned to</p>
                          {profile.assignedUser ? (
                            <div className="flex min-w-0 items-center gap-2">
                              <EntityAvatar
                                name={profile.assignedUser.name}
                                src={profile.assignedUser.avatarUrl}
                                size="sm"
                              />
                              <p className="truncate text-[var(--text-primary)]">
                                {profile.assignedUser.name}
                              </p>
                            </div>
                          ) : (
                            <StatusBadge muted>Unassigned</StatusBadge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="num-metric text-[var(--text-primary)]">{appCount} apps</p>
                          <p className="text-[13px] text-[var(--text-secondary)]">{interviewCount} interviews</p>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <CandidateEditor
          profile={selected}
          isNew={editingId === 'new'}
          canEdit={isAdmin}
          showSensitive={isAdmin}
          users={users}
          onError={setError}
          onBack={() => {
            setMode('list')
            setEditingId(null)
          }}
          onSaved={async () => {
            await load()
          }}
          onDeleted={async () => {
            setMode('list')
            setEditingId(null)
            await load()
          }}
        />
      )}
    </section>
  )
}

export function CandidateEditor({
  profile,
  isNew = false,
  canEdit,
  showSensitive,
  users = [],
  onError,
  onSaved,
  onBack,
  onDeleted,
}: {
  profile: CandidateProfile | null
  isNew?: boolean
  canEdit: boolean
  showSensitive: boolean
  users?: User[]
  onError: (message: string) => void
  onSaved: (id: number) => Promise<void>
  onBack?: () => void
  onDeleted?: () => Promise<void>
}) {
  const { user: actor } = useAuth()
  const [basic, setBasic] = useState<BasicDraft>(
    profile ? basicFromProfile(profile) : emptyBasic(),
  )
  const [jobs, setJobs] = useState<JobDraft[]>(
    profile?.experiences.map(jobFromRecord) ?? [],
  )
  const [schools, setSchools] = useState<SchoolDraft[]>(
    profile?.educations.map(schoolFromRecord) ?? [],
  )
  const [pending, setPending] = useState(false)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignPending, setAssignPending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [applicationCount, setApplicationCount] = useState<number | null>(null)
  const { ask, dialog } = useConfirmDialog()

  useEffect(() => {
    setBasic(profile ? basicFromProfile(profile) : emptyBasic())
    setJobs(profile?.experiences.map(jobFromRecord) ?? [])
    setSchools(profile?.educations.map(schoolFromRecord) ?? [])
  }, [profile])

  useEffect(() => {
    if (!profile?.id) {
      setApplicationCount(null)
      return
    }
    api
      .get<JobApplication[]>('/job-applications', {
        params: { candidateId: profile.id },
      })
      .then(({ data }) => setApplicationCount(data.length))
      .catch(() => setApplicationCount(null))
  }, [profile?.id])

  const profileId = profile?.id
  const assigneeOptions = useMemo(() => {
    return users
      .filter(
        (row) => row.isActive !== false && ASSIGNABLE_ROLES.includes(row.role),
      )
      .slice()
      .sort((a, b) => {
        if (actor && a.id === actor.id) return -1
        if (actor && b.id === actor.id) return 1
        const roleDelta = ROLE_SORT[a.role] - ROLE_SORT[b.role]
        if (roleDelta !== 0) {
          return roleDelta
        }
        return a.name.localeCompare(b.name)
      })
  }, [users, actor])

  function setField(key: keyof BasicDraft, value: string) {
    setBasic((prev) => ({ ...prev, [key]: value }))
  }

  async function persist(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) {
      return
    }
    onError('')
    setPending(true)
    try {
      const payload = {
        profileName: basic.profileName,
        firstName: basic.firstName,
        middleName: basic.middleName || null,
        lastName: basic.lastName,
        email: basic.email,
        phoneNumber: basic.phoneNumber,
        gender: basic.gender || null,
        dateOfBirth: showSensitive ? basic.dateOfBirth || null : undefined,
        streetAddress: showSensitive ? basic.streetAddress || null : undefined,
        city: basic.city,
        stateRegion: basic.stateRegion,
        zipPostalCode: basic.zipPostalCode,
        linkedinUrl: basic.linkedinUrl || null,
        githubUrl: basic.githubUrl || null,
        portfolioUrl: basic.portfolioUrl || null,
        raceEthnicity: showSensitive ? basic.raceEthnicity || null : undefined,
        veteranStatus: showSensitive ? basic.veteranStatus || null : undefined,
        disabilityStatus: showSensitive ? basic.disabilityStatus || null : undefined,
      }
      let id = profileId
      if (!id) {
        const { data } = await api.post<CandidateProfile>('/bidder-profiles', {
          ...payload,
          middleName: basic.middleName || undefined,
        })
        id = data.id
      } else {
        await api.patch(`/bidder-profiles/${id}`, payload)
      }

      for (const job of jobs) {
        if (!job.companyName.trim() || !job.startDate) {
          continue
        }
        const body = {
          companyName: job.companyName,
          industry: job.industry || null,
          city: job.city || null,
          state: job.state || null,
          startDate: job.startDate,
          endDate: job.currentlyWorksHere ? null : job.endDate || null,
          currentlyWorksHere: job.currentlyWorksHere,
        }
        if (job.id) {
          await api.patch(`/bidder-profiles/${id}/experiences/${job.id}`, body)
        } else {
          await api.post(`/bidder-profiles/${id}/experiences`, body)
        }
      }

      for (const school of schools) {
        if (!school.institutionName.trim()) {
          continue
        }
        const body = {
          institutionName: school.institutionName,
          degree: school.degree || null,
          fromDate: school.fromDate || null,
          toDate: school.toDate || null,
        }
        if (school.id) {
          await api.patch(`/bidder-profiles/${id}/educations/${school.id}`, body)
        } else {
          await api.post(`/bidder-profiles/${id}/educations`, body)
        }
      }

      await onSaved(id)
      onBack?.()
    } catch (err) {
      onError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function deleteJob(job: JobDraft) {
    onError('')
    if (job.id && profileId) {
      try {
        await api.delete(`/bidder-profiles/${profileId}/experiences/${job.id}`)
        await onSaved(profileId)
      } catch (err) {
        onError(getApiErrorMessage(err))
        throw err
      }
      return
    }
    setJobs((prev) => prev.filter((row) => row.key !== job.key))
  }

  function requestDeleteJob(job: JobDraft) {
    ask({
      title: 'Remove this job?',
      description: 'This work experience will be removed from the profile.',
      confirmLabel: 'Remove',
      pendingLabel: 'Removing…',
      action: () => deleteJob(job),
    })
  }

  async function deleteSchool(school: SchoolDraft) {
    onError('')
    if (school.id && profileId) {
      try {
        await api.delete(`/bidder-profiles/${profileId}/educations/${school.id}`)
        await onSaved(profileId)
      } catch (err) {
        onError(getApiErrorMessage(err))
        throw err
      }
      return
    }
    setSchools((prev) => prev.filter((row) => row.key !== school.key))
  }

  function requestDeleteSchool(school: SchoolDraft) {
    ask({
      title: 'Remove this school?',
      description: 'This education record will be removed from the profile.',
      confirmLabel: 'Remove',
      pendingLabel: 'Removing…',
      action: () => deleteSchool(school),
    })
  }

  async function assignBidder() {
    if (!profileId || !assignUserId || assignPending) {
      return
    }
    onError('')
    setAssignPending(true)
    try {
      await api.patch(`/bidder-profiles/${profileId}/assignment`, {
        bidderId: Number(assignUserId),
      })
      setAssignOpen(false)
      setAssignUserId('')
      await onSaved(profileId)
    } catch (err) {
      onError(getApiErrorMessage(err))
    } finally {
      setAssignPending(false)
    }
  }

  async function unassignBidder() {
    if (!profileId || assignPending) {
      return
    }
    onError('')
    setAssignPending(true)
    try {
      await api.patch(`/bidder-profiles/${profileId}/assignment`, {
        bidderId: null,
      })
      setAssignOpen(false)
      setAssignUserId('')
      await onSaved(profileId)
    } catch (err) {
      onError(getApiErrorMessage(err))
    } finally {
      setAssignPending(false)
    }
  }

  function deleteProfile() {
    if (!profileId || !onDeleted) {
      return
    }
    ask({
      title: 'Delete this profile?',
      description:
        'Applications and interviews for this profile will also be removed. This cannot be undone.',
      confirmLabel: 'Delete profile',
      action: async () => {
        onError('')
        setDeleting(true)
        try {
          await api.delete(`/bidder-profiles/${profileId}`)
          await onDeleted()
        } catch (err) {
          onError(getApiErrorMessage(err))
          throw err
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  const heading = isNew
    ? 'New profile'
    : basic.profileName || 'Profile'
  const displayName = [basic.firstName, basic.middleName, basic.lastName]
    .filter(Boolean)
    .join(' ')
  const assigned = profile?.assignedUser
  const assignedLabel = assigned
    ? 'Assigned'
    : profileId
      ? 'Unassigned'
      : 'Not saved'

  return (
    <div>
      {dialog}
      <div className="mb-5 rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <EntityAvatar name={displayName || heading} size="lg" />
            <div className="min-w-0">
            {onBack ? (
              <button
                type="button"
                className="mb-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                onClick={onBack}
              >
                ← Profiles
              </button>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-medium tracking-tight">{heading}</h1>
              <StatusBadge muted={!assigned}>{assignedLabel}</StatusBadge>
            </div>
            {displayName ? (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{displayName}</p>
            ) : null}
            <div className="mt-3 text-sm">
              <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
                Assigned to
              </p>
              {assigned ? (
                <p className="mt-0.5 text-[var(--text-secondary)]">
                  {assigned.name}
                  <span className="text-[var(--text-muted)]"> · {assigned.email}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-[var(--text-muted)]">
                  {profileId
                    ? 'No member assigned'
                    : 'Save the profile to assign a member'}
                </p>
              )}
              {canEdit && profileId ? (
                <Button
                  variant="secondary"
                  className="mt-2 !px-2.5 !py-1 text-xs"
                  onClick={() => setAssignOpen((open) => !open)}
                >
                  {assigned ? 'Change assignment' : 'Assign'}
                </Button>
              ) : null}
              {canEdit && assignOpen && profileId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="input-field mt-0"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                  >
                    <option value="">Select member</option>
                    {assigneeOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {ROLE_LABEL[row.role]}
                        {actor?.id === row.id ? ' (you)' : ''} ({row.email})
                      </option>
                    ))}
                  </select>
                  <Button
                    className="!px-2.5 !py-1.5 text-xs"
                    disabled={assignPending || !assignUserId}
                    onClick={() => void assignBidder()}
                  >
                    {assignPending ? 'Saving…' : 'Save assignment'}
                  </Button>
                  {assigned ? (
                    <Button
                      variant="ghost"
                      className="!px-2.5 !py-1.5 text-xs"
                      disabled={assignPending}
                      onClick={() => void unassignBidder()}
                    >
                      Unassign
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {profileId ? (
              <div className="mt-4 border-t border-[var(--border-glass)] pt-3">
                <p className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
                  Applications
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                  {applicationCount == null
                    ? '—'
                    : `${applicationCount} application${applicationCount === 1 ? '' : 's'}`}
                </p>
                <Link
                  to={`/applications?candidateId=${profileId}`}
                  className="mt-1 inline-block text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  View applications
                </Link>
              </div>
            ) : null}
            </div>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              {profileId && onDeleted ? (
                <Button
                  variant="danger"
                  disabled={deleting}
                  onClick={() => deleteProfile()}
                >
                  {deleting ? 'Deleting…' : 'Delete profile'}
                </Button>
              ) : null}
              <Button type="submit" form="candidate-profile-form" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Save profile'
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <form id="candidate-profile-form" onSubmit={persist} className="space-y-4">
        <section className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Personal information</h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            How this profile appears in the operations list.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field
                label="Profile name"
                required
                value={basic.profileName}
                onChange={(value) => setField('profileName', value)}
                disabled={!canEdit}
              />
            </div>
            <Field
              label="First name"
              required
              value={basic.firstName}
              onChange={(value) => setField('firstName', value)}
              disabled={!canEdit}
            />
            <Field
              label="Middle name"
              value={basic.middleName}
              onChange={(value) => setField('middleName', value)}
              disabled={!canEdit}
            />
            <Field
              label="Last name"
              required
              value={basic.lastName}
              onChange={(value) => setField('lastName', value)}
              disabled={!canEdit}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Contact and personal information</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field
              label="Email"
              type="email"
              required
              value={basic.email}
              onChange={(value) => setField('email', value)}
              disabled={!canEdit}
            />
            <Field
              label="Phone number"
              required
              value={basic.phoneNumber}
              onChange={(value) => setField('phoneNumber', value)}
              disabled={!canEdit}
            />
            <SelectField
              label="Gender"
              value={basic.gender}
              options={withCurrentOption(GENDER_OPTIONS, basic.gender)}
              onChange={(value) => setField('gender', value)}
              disabled={!canEdit}
            />
            {showSensitive ? (
              <Field
                label="Date of birth"
                type="date"
                value={basic.dateOfBirth}
                onChange={(value) => setField('dateOfBirth', value)}
                disabled={!canEdit}
              />
            ) : null}
            {showSensitive ? (
              <div className="md:col-span-2">
                <Field
                  label="Street address"
                  value={basic.streetAddress}
                  onChange={(value) => setField('streetAddress', value)}
                  disabled={!canEdit}
                />
              </div>
            ) : null}
            <Field
              label="City"
              required
              value={basic.city}
              onChange={(value) => setField('city', value)}
              disabled={!canEdit}
            />
            <Field
              label="State / region"
              required
              value={basic.stateRegion}
              onChange={(value) => setField('stateRegion', value)}
              disabled={!canEdit}
            />
            <Field
              label="ZIP / postal code"
              required
              value={basic.zipPostalCode}
              onChange={(value) => setField('zipPostalCode', value)}
              disabled={!canEdit}
            />
            <Field
              label="LinkedIn profile URL"
              value={basic.linkedinUrl}
              onChange={(value) => setField('linkedinUrl', value)}
              disabled={!canEdit}
            />
            <Field
              label="GitHub URL"
              value={basic.githubUrl}
              onChange={(value) => setField('githubUrl', value)}
              disabled={!canEdit}
            />
            <Field
              label="Portfolio URL"
              value={basic.portfolioUrl}
              onChange={(value) => setField('portfolioUrl', value)}
              disabled={!canEdit}
            />
            {showSensitive ? (
              <>
                <SelectField
                  label="Race / ethnicity"
                  value={basic.raceEthnicity}
                  options={withCurrentOption(RACE_OPTIONS, basic.raceEthnicity)}
                  onChange={(value) => setField('raceEthnicity', value)}
                  disabled={!canEdit}
                />
                <SelectField
                  label="Veteran status"
                  value={basic.veteranStatus}
                  options={withCurrentOption(VETERAN_OPTIONS, basic.veteranStatus)}
                  onChange={(value) => setField('veteranStatus', value)}
                  disabled={!canEdit}
                />
                <SelectField
                  label="Disability status"
                  value={basic.disabilityStatus}
                  options={withCurrentOption(
                    DISABILITY_OPTIONS,
                    basic.disabilityStatus,
                  )}
                  onChange={(value) => setField('disabilityStatus', value)}
                  disabled={!canEdit}
                />
              </>
            ) : (
              <p className="md:col-span-2 text-sm text-[var(--text-muted)]">
                Sensitive demographic fields are hidden for this role.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Work experience</h2>
              <p className="text-sm text-[var(--text-muted)]">Roles used on applications.</p>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="rounded-md border border-[var(--border-glass)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/5"
                onClick={() => setJobs((prev) => [...prev, newJob()])}
              >
                + Add job
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {jobs.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-glass)] px-4 py-5 text-center">
                <p className="text-sm text-[var(--text-muted)]">No work experience yet.</p>
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    onClick={() => setJobs((prev) => [...prev, newJob()])}
                  >
                    + Add job
                  </button>
                ) : null}
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.key}
                  className="rounded-lg border border-[var(--border-glass)] border-l-4 border-l-[var(--accent)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {job.industry || 'Role not specified'}
                      </p>
                      <p className="truncate text-sm text-[var(--text-secondary)]">
                        {job.companyName || 'Company not specified'}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {formatRange(
                          job.startDate,
                          job.endDate,
                          job.currentlyWorksHere,
                        )}
                      </p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-[var(--text-muted)] hover:text-red-200"
                        onClick={() => requestDeleteJob(job)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--border-glass)] pt-3 md:grid-cols-2">
                    <Field
                      label="Company name"
                      required
                      value={job.companyName}
                      onChange={(value) =>
                        setJobs((prev) =>
                          prev.map((row) =>
                            row.key === job.key
                              ? { ...row, companyName: value }
                              : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                      htmlRequired={false}
                    />
                    <Field
                      label="Industry"
                      value={job.industry}
                      onChange={(value) =>
                        setJobs((prev) =>
                          prev.map((row) =>
                            row.key === job.key ? { ...row, industry: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                    />
                    <Field
                      label="City"
                      value={job.city}
                      onChange={(value) =>
                        setJobs((prev) =>
                          prev.map((row) =>
                            row.key === job.key ? { ...row, city: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                    />
                    <Field
                      label="State"
                      value={job.state}
                      onChange={(value) =>
                        setJobs((prev) =>
                          prev.map((row) =>
                            row.key === job.key ? { ...row, state: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                    />
                    <Field
                      label="Start date"
                      type="date"
                      required
                      value={job.startDate}
                      onChange={(value) =>
                        setJobs((prev) =>
                          prev.map((row) =>
                            row.key === job.key ? { ...row, startDate: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                      htmlRequired={false}
                    />
                    <Field
                      label="End date"
                      type="date"
                      value={job.endDate}
                      onChange={(value) =>
                        setJobs((prev) =>
                          prev.map((row) =>
                            row.key === job.key ? { ...row, endDate: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit || job.currentlyWorksHere}
                    />
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                      <input
                        type="checkbox"
                        checked={job.currentlyWorksHere}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setJobs((prev) =>
                            prev.map((row) =>
                              row.key === job.key
                                ? {
                                    ...row,
                                    currentlyWorksHere: e.target.checked,
                                    endDate: e.target.checked ? '' : row.endDate,
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                      I currently work here
                    </label>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Education</h2>
              <p className="text-sm text-[var(--text-muted)]">Schools and programs.</p>
            </div>
            {canEdit ? (
              <button
                type="button"
                className="rounded-md border border-[var(--border-glass)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-white/5"
                onClick={() => setSchools((prev) => [...prev, newSchool()])}
              >
                + Add school
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {schools.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-glass)] px-4 py-5 text-center">
                <p className="text-sm text-[var(--text-muted)]">No education records yet.</p>
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    onClick={() => setSchools((prev) => [...prev, newSchool()])}
                  >
                    + Add school
                  </button>
                ) : null}
              </div>
            ) : (
              schools.map((school) => (
                <div
                  key={school.key}
                  className="rounded-md border border-[var(--border-glass)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {school.institutionName || 'School not specified'}
                      </p>
                      <p className="truncate text-sm text-[var(--text-secondary)]">
                        {school.degree || 'Degree not specified'}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {formatRange(school.fromDate, school.toDate)}
                      </p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-[var(--text-muted)] hover:text-red-200"
                        onClick={() => requestDeleteSchool(school)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[var(--border-glass)] pt-3 md:grid-cols-2">
                    <Field
                      label="Institution name"
                      required
                      value={school.institutionName}
                      onChange={(value) =>
                        setSchools((prev) =>
                          prev.map((row) =>
                            row.key === school.key
                              ? { ...row, institutionName: value }
                              : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                      htmlRequired={false}
                    />
                    <Field
                      label="Degree"
                      value={school.degree}
                      onChange={(value) =>
                        setSchools((prev) =>
                          prev.map((row) =>
                            row.key === school.key ? { ...row, degree: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                    />
                    <Field
                      label="From"
                      type="date"
                      value={school.fromDate}
                      onChange={(value) =>
                        setSchools((prev) =>
                          prev.map((row) =>
                            row.key === school.key
                              ? { ...row, fromDate: value }
                              : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                    />
                    <Field
                      label="To"
                      type="date"
                      value={school.toDate}
                      onChange={(value) =>
                        setSchools((prev) =>
                          prev.map((row) =>
                            row.key === school.key ? { ...row, toDate: value } : row,
                          ),
                        )
                      }
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {canEdit ? (
          <div className="flex items-center justify-end gap-3 pb-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                'Save profile'
              )}
            </Button>
          </div>
        ) : null}
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  htmlRequired,
  type = 'text',
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  htmlRequired?: boolean
  type?: string
  disabled?: boolean
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--text-secondary)]">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        className="input-field disabled:bg-white/5"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={htmlRequired ?? required}
        disabled={disabled}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="block text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <select
        className="input-field disabled:bg-white/5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}
