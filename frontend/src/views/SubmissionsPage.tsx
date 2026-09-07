import { useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidSubmission } from '../api/types'
import { Alert, Button } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { StatusBadge } from '../ui/StatusBadge'

function submissionTone(status: string) {
  if (status === 'ACCEPTED' || status === 'AWARDED') return 'success' as const
  if (status === 'REJECTED') return 'danger' as const
  if (status === 'SUBMITTED') return 'info' as const
  return 'muted' as const
}

export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<BidSubmission[]>([])
  const [error, setError] = useState('')

  async function load() {
    const { data } = await api.get<BidSubmission[]>('/bid-submissions')
    setSubmissions(data)
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  async function post(path: string) {
    setError('')
    try {
      await api.post(path)
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  async function award(projectId: number, submissionId: number) {
    setError('')
    try {
      await api.post(`/projects/${projectId}/award`, { submissionId })
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <section>
      <PageHeader
        title="Submissions"
        description="Review bids, then award a project to a submitted or accepted bid."
      />
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
              <th>Bidder</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold text-[var(--text-primary)]">
                  {row.projectTitle ?? `Project ${row.projectId}`}
                </td>
                <td>{row.bidderName ?? `Profile ${row.bidderProfileId}`}</td>
                <td className="num">
                  {row.currency} {Number(row.amount).toLocaleString()}
                </td>
                <td>
                  <StatusBadge tone={submissionTone(row.status)}>{row.status}</StatusBadge>
                </td>
                <td>
                  <span className="flex flex-wrap gap-2">
                    {row.status === 'SUBMITTED' ? (
                      <Button
                        variant="secondary"
                        className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                        onClick={() => post(`/bid-submissions/${row.id}/accept`)}
                      >
                        Accept
                      </Button>
                    ) : null}
                    {row.status === 'SUBMITTED' || row.status === 'ACCEPTED' ? (
                      <>
                        <Button
                          variant="danger"
                          className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                          onClick={() => post(`/bid-submissions/${row.id}/reject`)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="secondary"
                          className="!h-8 !min-h-8 !px-2 !py-1 text-xs"
                          onClick={() => award(row.projectId, row.id)}
                        >
                          Award project
                        </Button>
                      </>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No submissions." />
          </div>
        ) : null}
      </div>
    </section>
  )
}
