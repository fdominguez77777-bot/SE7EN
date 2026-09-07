import { useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidSubmission } from '../api/types'
import { Alert } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'

function submissionTone(status: string) {
  if (status === 'ACCEPTED' || status === 'AWARDED') return 'success' as const
  if (status === 'REJECTED') return 'danger' as const
  if (status === 'SUBMITTED') return 'info' as const
  return 'muted' as const
}

export function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<BidSubmission[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<BidSubmission[]>('/bid-submissions')
      .then(({ data }) => setSubmissions(data))
      .catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  return (
    <section>
      <PageHeader title="My submissions" description="Bids from your company." />
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      <div className="table-wrap mt-8">
        <table className="table-ui">
          <thead>
            <tr>
              <th>Project</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold text-[var(--text-primary)]">
                  {row.projectTitle ?? `Project ${row.projectId}`}
                </td>
                <td className="num">
                  {row.currency} {Number(row.amount).toLocaleString()}
                </td>
                <td>
                  <StatusBadge tone={submissionTone(row.status)}>{row.status}</StatusBadge>
                </td>
                <td>{row.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No bids yet." />
          </div>
        ) : null}
      </div>
    </section>
  )
}
