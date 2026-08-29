import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api, getApiErrorMessage } from '../api/client'
import type { BidInvitation } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function SubmitBidPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [invitations, setInvitations] = useState<BidInvitation[]>([])
  const [projectId, setProjectId] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    api
      .get<BidInvitation[]>('/bid-invitations')
      .then(({ data }) =>
        setInvitations(data.filter((row) => row.status === 'ACCEPTED')),
      )
      .catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await api.post('/bid-submissions', {
        projectId: Number(projectId),
        amount: Number(amount),
        currency: 'USD',
        notes: notes || undefined,
      })
      navigate('/my-submissions')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-medium">Submit bid</h1>
      <p className="mt-1 text-sm text-stone-600">
        Choose an accepted invitation and enter a price. The project must be
        open and before the deadline.
      </p>
      {user && !user.bidderProfileId ? (
        <p className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          Your user is not linked to a bidder profile yet.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-xl border border-stone-300 bg-white p-5"
      >
        <label className="block text-sm">
          Project
          <select
            className="mt-1 w-full border border-stone-300 px-3 py-2"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
            <option value="">Select accepted invitation</option>
            {invitations.map((invite) => (
              <option key={invite.id} value={invite.projectId}>
                {invite.projectTitle ?? `Project ${invite.projectId}`}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm">
          Amount (USD)
          <input
            className="mt-1 w-full border border-stone-300 px-3 py-2"
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          Notes
          <textarea
            className="mt-1 w-full border border-stone-300 px-3 py-2"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Submit bid
        </button>
      </form>
    </section>
  )
}
