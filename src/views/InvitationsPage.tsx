import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidInvitation, BidderProfile, Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, SectionCard } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'

function inviteTone(status: string) {
  if (status === 'ACCEPTED') return 'success' as const
  if (status === 'DECLINED') return 'danger' as const
  if (status === 'INVITED') return 'warning' as const
  return 'muted' as const
}

export function InvitationsPage() {
  const { user } = useAuth()
  const canInvite = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const [invitations, setInvitations] = useState<BidInvitation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [profiles, setProfiles] = useState<BidderProfile[]>([])
  const [projectId, setProjectId] = useState('')
  const [bidderProfileId, setBidderProfileId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const [inv, proj] = await Promise.all([
      api.get<BidInvitation[]>('/bid-invitations'),
      api.get<Project[]>('/projects'),
    ])
    setInvitations(inv.data)
    setProjects(proj.data)
    if (canInvite) {
      const { data } = await api.get<BidderProfile[]>('/bidder-profiles')
      setProfiles(data)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await api.post('/bid-invitations', {
        projectId: Number(projectId),
        bidderProfileId: Number(bidderProfileId),
      })
      setProjectId('')
      setBidderProfileId('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function setStatus(id: number, status: 'ACCEPTED' | 'DECLINED') {
    setError('')
    try {
      await api.patch(`/bid-invitations/${id}`, { status })
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const inviteableProjects = projects.filter(
    (project) => project.status === 'DRAFT' || project.status === 'OPEN',
  )

  return (
    <section>
      <PageHeader
        title="Invitations"
        description="Invite a bidder company to a draft or open project."
      />
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {canInvite ? (
        <SectionCard className="mt-6 max-w-xl" title="Invite bidder">
          <form onSubmit={onCreate}>
            <label className="block text-sm text-[var(--text-secondary)]">
              Project
              <select
                className="input-field"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
              >
                <option value="">Select project</option>
                {inviteableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title} ({project.status})
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm text-[var(--text-secondary)]">
              Bidder
              <select
                className="input-field"
                value={bidderProfileId}
                onChange={(e) => setBidderProfileId(e.target.value)}
                required
              >
                <option value="">Select bidder</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.profileName}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={pending} className="mt-4">
              Invite
            </Button>
          </form>
        </SectionCard>
      ) : null}

      <div className="table-wrap mt-8">
        <table className="table-ui">
          <thead>
            <tr>
              <th>Project</th>
              <th>Bidder</th>
              <th>Status</th>
              {user?.role === 'BIDDER' ? <th>Respond</th> : null}
            </tr>
          </thead>
          <tbody>
            {invitations.map((invite) => (
              <tr key={invite.id}>
                <td className="font-semibold text-[var(--text-primary)]">
                  {invite.projectTitle ?? `Project ${invite.projectId}`}
                </td>
                <td>{invite.bidderName ?? `Profile ${invite.bidderProfileId}`}</td>
                <td>
                  <StatusBadge tone={inviteTone(invite.status)}>{invite.status}</StatusBadge>
                </td>
                {user?.role === 'BIDDER' ? (
                  <td>
                    {invite.status === 'INVITED' ? (
                      <span className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                          onClick={() => setStatus(invite.id, 'ACCEPTED')}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                          onClick={() => setStatus(invite.id, 'DECLINED')}
                        >
                          Decline
                        </Button>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {invitations.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No invitations." />
          </div>
        ) : null}
      </div>
    </section>
  )
}
