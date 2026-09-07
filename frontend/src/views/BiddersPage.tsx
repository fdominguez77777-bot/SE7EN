import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { CandidateProfile, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { CardSkeleton } from '../ui/loading/page-skeletons'
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

export function BiddersPage() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const isAdmin = user?.role === 'ADMIN'
  const [bidders, setBidders] = useState<User[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
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

  async function load() {
    const [{ data: bidderRows }, { data: profileRows }] = await Promise.all([
      api.get<User[]>('/users/bidders'),
      api.get<CandidateProfile[]>('/bidder-profiles'),
    ])
    setBidders(bidderRows)
    setProfiles(profileRows)
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(
    () => buildBidderReport(bidders, profiles, []),
    [bidders, profiles],
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
        eyebrow="Operations"
        title="Bidders"
        description="Manage bidder accounts, credentials, and assigned profiles."
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
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No bidder users yet." />
        </div>
      ) : (
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
      )}

      {selected ? (
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
}) {
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
