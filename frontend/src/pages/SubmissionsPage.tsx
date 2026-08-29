import { useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidSubmission } from '../api/types'

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
      <h1 className="text-2xl font-medium">Submissions</h1>
      <p className="mt-1 text-sm text-stone-600">
        Review bids, then award a project to a submitted or accepted bid.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Bidder</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row) => (
              <tr key={row.id} className="border-t border-stone-200">
                <td className="px-4 py-2">
                  {row.projectTitle ?? `Project ${row.projectId}`}
                </td>
                <td className="px-4 py-2">
                  {row.bidderName ?? `Profile ${row.bidderProfileId}`}
                </td>
                <td className="px-4 py-2">
                  {row.currency} {Number(row.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2">{row.status}</td>
                <td className="px-4 py-2">
                  <span className="flex flex-wrap gap-2">
                    {row.status === 'SUBMITTED' ? (
                      <button
                        type="button"
                        className="border border-stone-400 px-2 py-1"
                        onClick={() =>
                          post(`/bid-submissions/${row.id}/accept`)
                        }
                      >
                        Accept
                      </button>
                    ) : null}
                    {row.status === 'SUBMITTED' || row.status === 'ACCEPTED' ? (
                      <>
                        <button
                          type="button"
                          className="border border-stone-400 px-2 py-1"
                          onClick={() =>
                            post(`/bid-submissions/${row.id}/reject`)
                          }
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="border border-stone-400 px-2 py-1"
                          onClick={() => award(row.projectId, row.id)}
                        >
                          Award project
                        </button>
                      </>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">No submissions.</p>
        ) : null}
      </div>
    </section>
  )
}
