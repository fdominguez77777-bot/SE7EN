import { useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidSubmission } from '../api/types'

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
      <h1 className="text-2xl font-medium">My submissions</h1>
      <p className="mt-1 text-sm text-stone-600">Bids from your company.</p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((row) => (
              <tr key={row.id} className="border-t border-stone-200">
                <td className="px-4 py-2">
                  {row.projectTitle ?? `Project ${row.projectId}`}
                </td>
                <td className="px-4 py-2">
                  {row.currency} {Number(row.amount).toLocaleString()}
                </td>
                <td className="px-4 py-2">{row.status}</td>
                <td className="px-4 py-2">{row.notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">No bids yet.</p>
        ) : null}
      </div>
    </section>
  )
}
