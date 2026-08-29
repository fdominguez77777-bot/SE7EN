import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { ActivityRow, CandidateProfile, DashboardSummary } from '../api/types'
import { useAuth } from '../auth/AuthContext'

function weekAgoIsoDate() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString().slice(0, 10)
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function DashboardPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const [from, setFrom] = useState(weekAgoIsoDate())
  const [to, setTo] = useState(todayIsoDate())
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [error, setError] = useState('')
  const [profileId, setProfileId] = useState('')
  const [type, setType] = useState('RESUME')
  const [delta, setDelta] = useState('1')
  const [note, setNote] = useState('')

  async function load() {
    const { data } = await api.get<DashboardSummary>('/dashboard', {
      params: { from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` },
    })
    setRows(data.byCandidate)
    if (isStaff) {
      const { data: profileRows } =
        await api.get<CandidateProfile[]>('/bidder-profiles')
      setProfiles(profileRows)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [from, to])

  async function onAdjust(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.post('/activity/adjustments', {
        candidateProfileId: Number(profileId),
        type,
        delta: Number(delta),
        note: note || undefined,
        occurredAt: `${from}T12:00:00.000Z`,
      })
      setNote('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <section>
      <h1 className="text-2xl font-medium">
        {isStaff ? 'Team activity' : 'My dashboard'}
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Manual counts for the selected period. Integrations can replace this later.
      </p>
      {user?.role === 'BIDDER' && !user.bidderProfileId ? (
        <p className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          Your account is not linked to a candidate profile yet.
        </p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <label>
          From
          <input
            className="ml-2 border border-stone-300 px-2 py-1"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            className="ml-2 border border-stone-300 px-2 py-1"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Bidder</th>
              <th className="px-4 py-2 font-medium">Resumes generated</th>
              <th className="px-4 py-2 font-medium">Applications</th>
              <th className="px-4 py-2 font-medium">Interviews</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.candidateProfileId} className="border-t border-stone-200">
                <td className="px-4 py-2">{row.profileName}</td>
                <td className="px-4 py-2">{row.resumesGenerated}</td>
                <td className="px-4 py-2">{row.applications}</td>
                <td className="px-4 py-2">{row.interviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">No activity in this period.</p>
        ) : null}
      </div>

      {isStaff ? (
        <form
          onSubmit={onAdjust}
          className="mt-8 max-w-xl border border-stone-300 bg-white p-5"
        >
          <h2 className="text-sm font-medium">Correct a count</h2>
          <label className="mt-3 block text-sm">
            Candidate
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              required
            >
              <option value="">Select</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.profileName}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Type
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="RESUME">Resumes generated</option>
              <option value="APPLICATION">Applications</option>
              <option value="INTERVIEW">Interviews</option>
            </select>
          </label>
          <label className="mt-3 block text-sm">
            Delta (use negative to subtract)
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 block text-sm">
            Note
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white"
          >
            Apply correction
          </button>
        </form>
      ) : null}
    </section>
  )
}
