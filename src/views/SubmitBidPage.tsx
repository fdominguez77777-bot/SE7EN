import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from '@/lib/navigation'

import { api, getApiErrorMessage } from '../api/client'
import type { BidInvitation } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, SectionCard } from '../ui/chrome'
import { PageHeader } from '../ui/page-header'

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
      <PageHeader
        title="Submit bid"
        description="Choose an accepted invitation and enter a price. The project must be open and before the deadline."
      />
      {user && !invitations.length ? (
        <div className="mt-4">
          <Alert tone="warning">Your user is not linked to a bidder profile yet.</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <SectionCard className="mt-6 max-w-xl">
        <form onSubmit={onSubmit}>
          <label className="block text-sm text-[var(--text-secondary)]">
            Project
            <select
              className="input-field"
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
          <label className="mt-3 block text-sm text-[var(--text-secondary)]">
            Amount (USD)
            <input
              className="input-field"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 block text-sm text-[var(--text-secondary)]">
            Notes
            <textarea
              className="input-field"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={pending} className="mt-4">
            Submit bid
          </Button>
        </form>
      </SectionCard>
    </section>
  )
}
