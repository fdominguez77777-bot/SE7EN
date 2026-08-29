import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidInvitation, BidderProfile, Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'

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
      <h1 className="text-2xl font-medium">Invitations</h1>
      <p className="mt-1 text-sm text-stone-600">
        Invite a bidder company to a draft or open project.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {canInvite ? (
        <form
          onSubmit={onCreate}
          className="mt-6 max-w-xl border border-stone-300 bg-white p-5"
        >
          <h2 className="text-sm font-medium">Invite bidder</h2>
          <label className="mt-3 block text-sm">
            Project
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
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
          <label className="mt-3 block text-sm">
            Bidder
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
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
          <button
            type="submit"
            disabled={pending}
            className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Invite
          </button>
        </form>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Bidder</th>
              <th className="px-4 py-2 font-medium">Status</th>
              {user?.role === 'BIDDER' ? (
                <th className="px-4 py-2 font-medium">Respond</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {invitations.map((invite) => (
              <tr key={invite.id} className="border-t border-stone-200">
                <td className="px-4 py-2">
                  {invite.projectTitle ?? `Project ${invite.projectId}`}
                </td>
                <td className="px-4 py-2">
                  {invite.bidderName ?? `Profile ${invite.bidderProfileId}`}
                </td>
                <td className="px-4 py-2">{invite.status}</td>
                {user?.role === 'BIDDER' ? (
                  <td className="px-4 py-2">
                    {invite.status === 'INVITED' ? (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          className="border border-stone-400 px-2 py-1"
                          onClick={() => setStatus(invite.id, 'ACCEPTED')}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="border border-stone-400 px-2 py-1"
                          onClick={() => setStatus(invite.id, 'DECLINED')}
                        >
                          Decline
                        </button>
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
          <p className="px-4 py-6 text-sm text-stone-500">No invitations.</p>
        ) : null}
      </div>
    </section>
  )
}
