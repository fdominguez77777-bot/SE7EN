import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, getApiErrorMessage } from '../api/client'
import type { DashboardSummary } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<DashboardSummary>('/dashboard')
      .then(({ data: summary }) => setData(summary))
      .catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  const isStaff = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'

  return (
    <section>
      <h1 className="text-2xl font-medium">Dashboard</h1>
      <p className="mt-1 text-sm text-stone-600">
        {user?.name} · {user?.role}
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      {user?.role === 'BIDDER' && !user.bidderProfileId ? (
        <p className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your account is not linked to a bidder profile. Ask an admin to
          attach your user on the Bidders page before you can submit bids.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {isStaff ? (
          <>
            <Stat label="Open projects" value={data?.openProjects} />
            <Stat label="Bids to review" value={data?.submissionsToReview} />
            <Stat label="Invitations sent" value={data?.invitationsSent} />
          </>
        ) : (
          <>
            <Stat label="Pending invitations" value={data?.pendingInvitations} />
            <Stat label="My submissions" value={data?.mySubmissions} />
            <Stat label="Open projects" value={data?.openProjects} />
          </>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        {isStaff ? (
          <>
            <Link className="border border-stone-400 px-3 py-2" to="/projects">
              Manage projects
            </Link>
            <Link className="border border-stone-400 px-3 py-2" to="/submissions">
              Review bids
            </Link>
          </>
        ) : (
          <>
            <Link className="border border-stone-400 px-3 py-2" to="/invitations">
              Invitations
            </Link>
            <Link className="border border-stone-400 px-3 py-2" to="/submit-bid">
              Submit a bid
            </Link>
          </>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="border border-stone-300 bg-white px-4 py-5">
      <p className="text-xs text-stone-500 uppercase">{label}</p>
      <p className="mt-2 text-2xl">{value ?? '—'}</p>
    </div>
  )
}
