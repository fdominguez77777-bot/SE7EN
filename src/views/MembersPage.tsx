import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from '../routing'
import { Plus, Search, Shield, UserRound, UsersRound } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { MemberDetail, Role, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { AvatarPhotoDialog } from '../ui/AvatarPhotoDialog'
import { Alert, Button, SectionCard, StatCard } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { EmptyState } from '../ui/EmptyState'
import { LoginPasswordPanel } from '../ui/login-password'
import { TableSkeleton } from '../ui/loading/page-skeletons'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'
import {
  DEFAULT_MEMBER_PASSWORD,
  ROLE_LABEL,
  composeName,
  formatMemberDate,
  roleBadgeTone,
  splitName,
} from '../ui/roles'

type RoleFilter = 'all' | Role
type StatusFilter = 'all' | 'active' | 'disabled'
type Mode = 'list' | 'create' | 'detail'

const ROLE_OPTIONS: Role[] = ['ADMIN', 'BID_MANAGER', 'BIDDER']

function isActiveMember(member: User): boolean {
  return member.isActive !== false
}

function generateTemporaryPassword(): string {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join('')
}

export function MembersPage() {
  const { user: currentUser, applyUser } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const [members, setMembers] = useState<User[]>([])
  const [mode, setMode] = useState<Mode>('list')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<MemberDetail | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('BIDDER')
  const [createPassword, setCreatePassword] = useState(DEFAULT_MEMBER_PASSWORD)
  const [useDefaultPassword, setUseDefaultPassword] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [photoOpen, setPhotoOpen] = useState(false)

  async function loadMembers() {
    const { data } = await api.get<User[]>('/users')
    setMembers(data)
    return data
  }

  async function loadDetail(id: number) {
    const { data } = await api.get<MemberDetail>(`/users/${id}`)
    setDetail(data)
    const parts = splitName(data.name)
    setFirstName(parts.firstName)
    setLastName(parts.lastName)
    setEmail(data.email)
    setRole(data.role)
    return data
  }

  useEffect(() => {
    setLoading(true)
    loadMembers()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return members.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) {
        return false
      }
      if (statusFilter === 'active' && !isActiveMember(member)) {
        return false
      }
      if (statusFilter === 'disabled' && isActiveMember(member)) {
        return false
      }
      if (!needle) {
        return true
      }
      return `${member.name} ${member.email}`.toLowerCase().includes(needle)
    })
  }, [members, query, roleFilter, statusFilter])

  const stats = useMemo(() => {
    return {
      total: members.length,
      admins: members.filter((row) => row.role === 'ADMIN').length,
      managers: members.filter((row) => row.role === 'BID_MANAGER').length,
      bidders: members.filter((row) => row.role === 'BIDDER').length,
      active: members.filter(isActiveMember).length,
      disabled: members.filter((row) => !isActiveMember(row)).length,
    }
  }, [members])

  const selected = members.find((row) => row.id === selectedId) ?? detail
  const isSelf = currentUser?.id === selectedId
  const activeAdminCount = members.filter(
    (row) => row.role === 'ADMIN' && isActiveMember(row),
  ).length
  const isLastAdmin =
    selected?.role === 'ADMIN' && activeAdminCount <= 1 && isActiveMember(selected)
  const canChangeRole = !isSelf && !isLastAdmin
  const canDisable = !isSelf && !isLastAdmin
  const canDelete = !isSelf && !isLastAdmin

  function openCreate() {
    setMode('create')
    setSelectedId(null)
    setDetail(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setRole('BIDDER')
    setCreatePassword(DEFAULT_MEMBER_PASSWORD)
    setUseDefaultPassword(true)
    setError('')
    setNotice('')
  }

  async function openDetail(id: number) {
    setError('')
    setNotice('')
    setResetOpen(false)
    setNewPassword('')
    setConfirmPassword('')
    setSelectedId(id)
    setMode('detail')
    try {
      await loadDetail(id)
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  function backToList() {
    setMode('list')
    setSelectedId(null)
    setDetail(null)
    setResetOpen(false)
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    const name = composeName(firstName, lastName)
    if (!name) {
      setError('Enter a first name or last name.')
      return
    }
    setPending(true)
    try {
      await api.post('/users', {
        name,
        email,
        role,
        ...(useDefaultPassword
          ? { useDefaultPassword: true }
          : { password: createPassword }),
      })
      await loadMembers()
      setNotice(
        useDefaultPassword
          ? `Member created. Sign-in password: ${DEFAULT_MEMBER_PASSWORD}`
          : 'Member created.',
      )
      backToList()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function onSaveAccount(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) {
      return
    }
    setError('')
    setNotice('')
    const name = composeName(firstName, lastName)
    if (!name) {
      setError('Enter a first name or last name.')
      return
    }
    setPending(true)
    try {
      await api.patch(`/users/${selectedId}`, { name, email })
      await Promise.all([loadMembers(), loadDetail(selectedId)])
      setNotice('Member updated.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function onSaveAccess(event: FormEvent) {
    event.preventDefault()
    if (!selectedId || !selected) {
      return
    }
    setError('')
    setNotice('')
    setPending(true)
    try {
      await api.patch(`/users/${selectedId}`, { role })
      await Promise.all([loadMembers(), loadDetail(selectedId)])
      setNotice('Role updated.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function onResetPassword(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) {
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation must match.')
      return
    }
    setError('')
    setNotice('')
    setPending(true)
    try {
      await api.patch(`/users/${selectedId}/password`, { newPassword })
      setNotice(
        `Password reset successfully. Share this sign-in password: ${newPassword}`,
      )
      setNewPassword('')
      setConfirmPassword('')
      setResetOpen(false)
      setGeneratedPassword('')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function requestSetDefaultPassword() {
    if (!selected) {
      return
    }
    ask({
      title: `Set the default password for ${selected.name}?`,
      description: `They will sign in with ${DEFAULT_MEMBER_PASSWORD}. Share that password with them. The previous password cannot be recovered.`,
      confirmLabel: 'Set default password',
      pendingLabel: 'Saving…',
      confirmTone: 'primary',
      action: async () => {
        try {
          await api.patch(`/users/${selected.id}/password`, { useDefault: true })
          setNotice(
            `Password reset successfully. Sign-in password: ${DEFAULT_MEMBER_PASSWORD}`,
          )
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  function requestDisable() {
    if (!selected) {
      return
    }
    ask({
      title: `Disable ${selected.name}?`,
      description: 'They will no longer be able to sign in.',
      confirmLabel: 'Disable member',
      pendingLabel: 'Disabling…',
      action: async () => {
        try {
          await api.patch(`/users/${selected.id}`, { isActive: false })
          await Promise.all([loadMembers(), loadDetail(selected.id)])
          setNotice('Member disabled.')
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  async function reactivate() {
    if (!selectedId) {
      return
    }
    setError('')
    setPending(true)
    try {
      await api.patch(`/users/${selectedId}`, { isActive: true })
      await Promise.all([loadMembers(), loadDetail(selectedId)])
      setNotice('Member reactivated.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  function requestDelete() {
    if (!selected) {
      return
    }
    ask({
      title: 'Delete this member permanently?',
      description:
        'The account is removed. Applications and interviews stay on the profiles. Prefer Disable if you only want to stop sign-in.',
      confirmLabel: 'Delete member',
      action: async () => {
        try {
          await api.delete(`/users/${selected.id}`)
          await loadMembers()
          setNotice('Member deleted.')
          backToList()
        } catch (err) {
          setError(getApiErrorMessage(err))
          throw err
        }
      },
    })
  }

  return (
    <section>
      {dialog}
      {photoOpen && selected ? (
        <AvatarPhotoDialog
          name={selected.name}
          src={selected.avatarUrl}
          endpoint={`/users/${selected.id}/avatar`}
          onClose={() => setPhotoOpen(false)}
          onSaved={(next) => {
            setMembers((rows) =>
              rows.map((row) => (row.id === next.id ? { ...row, ...next } : row)),
            )
            setDetail((current) =>
              current && current.id === next.id
                ? { ...current, ...next }
                : current,
            )
            if (currentUser?.id === next.id) {
              applyUser(next)
            }
            setPhotoOpen(false)
          }}
        />
      ) : null}
      {mode === 'list' ? (
        <>
          <PageHeader
            eyebrow="Admin"
            title="Members"
            description="Manage platform accounts, roles, and access."
            actions={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add Member
              </Button>
            }
          />
        </>
      ) : (
        <PageHeader
          eyebrow="Admin"
          title={mode === 'create' ? 'Add Member' : selected?.name || 'Member'}
          description={
            mode === 'create'
              ? 'Create an Admin, Bid Manager, or Bidder account.'
              : selected?.email
          }
          actions={
            <Button variant="secondary" onClick={backToList}>
              ← Members
            </Button>
          }
        />
      )}

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

      {mode === 'list' ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard value={stats.total} label="Total Members" icon={UsersRound} />
            <StatCard value={stats.admins} label="Admins" icon={Shield} tone="neutral" />
            <StatCard
              value={stats.managers}
              label="Bid Managers"
              icon={UserRound}
              tone="neutral"
            />
            <StatCard value={stats.bidders} label="Bidders" icon={UsersRound} tone="neutral" />
            <StatCard value={stats.active} label="Active" tone="success" />
            <StatCard value={stats.disabled} label="Disabled" tone="neutral" />
          </div>

          <div className="glass-toolbar mt-5 flex flex-col gap-3 px-3 py-2.5 md:flex-row md:items-center">
            <label className="input-with-icon min-w-0 flex-1">
              <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                className="input-field mt-0"
                placeholder="Search name or email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="text-sm text-[var(--text-secondary)]">
              Role
              <select
                className="input-field mt-1 md:mt-0 md:ml-2 md:w-44"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              >
                <option value="all">All</option>
                <option value="ADMIN">Admin</option>
                <option value="BID_MANAGER">Bid Manager</option>
                <option value="BIDDER">Bidder</option>
              </select>
            </label>
            <label className="text-sm text-[var(--text-secondary)]">
              Status
              <select
                className="input-field mt-1 md:mt-0 md:ml-2 md:w-36"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="mt-5">
              <TableSkeleton rows={5} />
            </div>
          ) : members.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="No members found." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="No members match these filters." />
            </div>
          ) : (
            <>
              <div className="mt-5 hidden md:block">
                <div className="table-wrap">
                  <table className="table-ui">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((member) => (
                        <tr
                          key={member.id}
                          className="interactive-row"
                          onClick={() => void openDetail(member.id)}
                        >
                          <td>
                            <div className="flex items-center gap-2.5">
                              <EntityAvatar name={member.name} src={member.avatarUrl} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-[var(--text-primary)]">
                                  {member.name}
                                </p>
                                <p className="text-xs text-[var(--text-meta)]">#{member.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-[var(--text-secondary)]">{member.email}</td>
                          <td>
                            <StatusBadge tone={roleBadgeTone(member.role)}>
                              {ROLE_LABEL[member.role]}
                            </StatusBadge>
                          </td>
                          <td>
                            <StatusBadge
                              tone={isActiveMember(member) ? 'success' : 'danger'}
                            >
                              {isActiveMember(member) ? 'Active' : 'Disabled'}
                            </StatusBadge>
                          </td>
                          <td className="text-xs text-[var(--text-meta)]">
                            {formatMemberDate(member.created_at)}
                          </td>
                          <td onClick={(event) => event.stopPropagation()}>
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs"
                              onClick={() => void openDetail(member.id)}
                            >
                              Manage
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 space-y-3 md:hidden">
                {filtered.map((member) => (
                  <article
                    key={member.id}
                    className="interactive-block rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-4 py-3.5"
                    role="button"
                    tabIndex={0}
                    onClick={() => void openDetail(member.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void openDetail(member.id)
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <EntityAvatar name={member.name} src={member.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--text-primary)]">
                          {member.name}
                        </p>
                        <p className="truncate text-sm text-[var(--text-secondary)]">{member.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <StatusBadge tone={roleBadgeTone(member.role)}>
                            {ROLE_LABEL[member.role]}
                          </StatusBadge>
                          <StatusBadge
                            tone={isActiveMember(member) ? 'success' : 'danger'}
                          >
                            {isActiveMember(member) ? 'Active' : 'Disabled'}
                          </StatusBadge>
                        </div>
                        <p className="mt-2 text-xs text-[var(--text-muted)]">
                          Created {formatMemberDate(member.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        onClick={(event) => {
                          event.stopPropagation()
                          void openDetail(member.id)
                        }}
                      >
                        Manage
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

      {mode === 'create' ? (
        <form
          onSubmit={onCreate}
          className="mt-5 max-w-xl rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          <h2 className="text-base font-semibold text-[var(--text-primary)]">New account</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-[var(--text-secondary)]">First name</span>
              <input
                className="input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--text-secondary)]">Last name</span>
              <input
                className="input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="text-[var(--text-secondary)]">Email</span>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="text-sm md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={useDefaultPassword}
                onChange={(e) => {
                  const checked = e.target.checked
                  setUseDefaultPassword(checked)
                  if (checked) {
                    setCreatePassword(DEFAULT_MEMBER_PASSWORD)
                  }
                }}
              />
              <span className="text-[var(--text-secondary)]">
                Use default password ({DEFAULT_MEMBER_PASSWORD})
              </span>
            </label>
            {useDefaultPassword ? (
              <p className="text-sm text-[var(--text-secondary)] md:col-span-2">
                They will sign in with{' '}
                <span className="font-mono font-medium">{DEFAULT_MEMBER_PASSWORD}</span>
                . Share this with them after you create the account.
              </p>
            ) : (
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Initial password</span>
                <input
                  className="input-field"
                  type="text"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  minLength={8}
                  maxLength={72}
                  required
                />
              </label>
            )}
            <label className="text-sm">
              <span className="text-[var(--text-secondary)]">Role</span>
              <select
                className="input-field"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABEL[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create member'}
            </Button>
            <Button variant="secondary" onClick={backToList}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'detail' && selected ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-solid)] px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <EntityAvatar name={selected.name} src={selected.avatarUrl} size="lg" />
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selected.name}</h2>
                  <p className="text-sm text-[var(--text-muted)]">{selected.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StatusBadge tone={roleBadgeTone(selected.role)}>
                      {ROLE_LABEL[selected.role]}
                    </StatusBadge>
                    <StatusBadge
                      tone={isActiveMember(selected) ? 'success' : 'danger'}
                    >
                      {isActiveMember(selected) ? 'Active' : 'Disabled'}
                    </StatusBadge>
                  </div>
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    onClick={() => setPhotoOpen(true)}
                  >
                    {selected.avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <LoginPasswordPanel
            personName={selected.name}
            onApplyDefault={requestSetDefaultPassword}
            pending={pending}
          />

          <SectionCard title="Account information" description="Name is stored as a single full name on the account.">
            <form onSubmit={onSaveAccount} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">First name</span>
                <input
                  className="input-field"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Last name</span>
                <input
                  className="input-field"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="text-[var(--text-secondary)]">Email</span>
                <input
                  className="input-field"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <div className="md:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save information'}
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Access" description="Role and sign-in status.">
            <form onSubmit={onSaveAccess} className="space-y-3">
              <label className="block text-sm">
                <span className="text-[var(--text-secondary)]">Role</span>
                <select
                  className="input-field max-w-xs"
                  value={role}
                  disabled={!canChangeRole}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABEL[option]}
                    </option>
                  ))}
                </select>
              </label>
              {isSelf ? (
                <p className="text-sm text-[var(--text-muted)]">
                  You cannot change your own role.
                </p>
              ) : isLastAdmin ? (
                <p className="text-sm text-[var(--text-muted)]">
                  This is the last Admin account. The role cannot be changed.
                </p>
              ) : null}
              <Button type="submit" disabled={pending || !canChangeRole}>
                {pending ? 'Saving…' : 'Update role'}
              </Button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-glass)] pt-4">
              {isActiveMember(selected) ? (
                <Button
                  variant="danger"
                  disabled={!canDisable || pending}
                  onClick={requestDisable}
                >
                  Disable account
                </Button>
              ) : (
                <Button disabled={pending} onClick={() => void reactivate()}>
                  Reactivate account
                </Button>
              )}
              <Button
                variant="danger"
                disabled={!canDelete || pending}
                onClick={requestDelete}
              >
                Delete member
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Security"
            description="You can set a new password or the default password. Stored passwords cannot be shown because they are hashed."
          >
            <p className="text-sm text-[var(--text-secondary)]">
              Default password:{' '}
              <span className="font-mono font-medium">{DEFAULT_MEMBER_PASSWORD}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={requestSetDefaultPassword} disabled={pending}>
                Set default password
              </Button>
              {!resetOpen ? (
                <Button variant="secondary" onClick={() => setResetOpen(true)}>
                  Set a custom password
                </Button>
              ) : null}
            </div>
            {resetOpen ? (
              <form onSubmit={onResetPassword} className="mt-4 max-w-md space-y-3">
                <label className="block text-sm">
                  <span className="text-[var(--text-secondary)]">New password</span>
                  <input
                    className="input-field"
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-[var(--text-secondary)]">Confirm new password</span>
                  <input
                    className="input-field"
                    type="text"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Resetting…' : 'Save new password'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const next = generateTemporaryPassword()
                      setNewPassword(next)
                      setConfirmPassword(next)
                      setGeneratedPassword(next)
                    }}
                  >
                    Generate temporary password
                  </Button>
                  <Button variant="ghost" onClick={() => setResetOpen(false)}>
                    Cancel
                  </Button>
                </div>
                {generatedPassword ? (
                  <p className="rounded-lg border border-[var(--border-glass)] bg-white/5 px-3 py-2 text-sm text-[var(--text-secondary)]">
                    Temporary password (copy now, it will not be shown again):{' '}
                    <span className="font-mono">{generatedPassword}</span>
                  </p>
                ) : null}
              </form>
            ) : null}
          </SectionCard>

          <SectionCard title="Account details">
            <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium tracking-wide text-[var(--text-muted)] uppercase">
                  Created
                </dt>
                <dd className="mt-0.5 text-[var(--text-primary)]">
                  {formatMemberDate(selected.created_at)}
                </dd>
              </div>
            </dl>
          </SectionCard>

          {selected.role === 'BIDDER' ? (
            <SectionCard
              title="Bidder context"
              description="Operational work stays on the Bidders page."
            >
              <p className="text-sm text-[var(--text-secondary)]">
                Assigned candidates:{' '}
                <span className="font-medium">
                  {detail?.assignedProfileCount ?? '—'}
                </span>
              </p>
              <Link
                to={`/bidders?bidderId=${selected.id}`}
                className="mt-3 inline-block text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                View bidder operations
              </Link>
            </SectionCard>
          ) : null}

          {selected.role === 'BID_MANAGER' ? (
            <SectionCard title="Compensation" description="Salary is configured in Compensation settings.">
              <Link
                to="/settings/compensation"
                className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
              >
                View compensation settings
              </Link>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
