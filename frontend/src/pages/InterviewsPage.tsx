import { type FormEvent, useEffect, useMemo, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { CandidateProfile, Interview } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function InterviewsPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const [items, setItems] = useState<Interview[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [error, setError] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [candidateProfileId, setCandidateProfileId] = useState('')
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [round, setRound] = useState('')
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')

  async function load() {
    const { data } = await api.get<Interview[]>('/interviews')
    setItems(data)
    if (isStaff) {
      const { data: profileRows } =
        await api.get<CandidateProfile[]>('/bidder-profiles')
      setProfiles(profileRows)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.post('/interviews', {
        candidateProfileId: Number(candidateProfileId),
        company,
        jobTitle,
        startsAt: new Date(startsAt).toISOString(),
        round: round || undefined,
        result: result || undefined,
        notes: notes || undefined,
        source: 'MANUAL',
      })
      setCompany('')
      setJobTitle('')
      setStartsAt('')
      setRound('')
      setResult('')
      setNotes('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const days = useMemo(() => calendarDays(month), [month])
  const byDay = useMemo(() => {
    const map = new Map<string, Interview[]>()
    for (const item of items) {
      const key = localDateKey(new Date(item.startsAt))
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [items])

  return (
    <section>
      <h1 className="text-2xl font-medium">
        {isStaff ? 'Interviews' : 'My interviews'}
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        Manual interview calendar. Google Calendar can be added later.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {isStaff ? (
        <form
          onSubmit={onCreate}
          className="mt-6 grid max-w-5xl grid-cols-1 gap-3 border border-stone-300 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <h2 className="sm:col-span-2 lg:col-span-3 text-sm font-medium">
            Add interview
          </h2>
          <label className="block text-sm">
            Candidate
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={candidateProfileId}
              onChange={(e) => setCandidateProfileId(e.target.value)}
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
          <label className="block text-sm">
            Company
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Job title
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Date / time
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Round
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={round}
              onChange={(e) => setRound(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Result
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </label>
          <label className="sm:col-span-2 lg:col-span-3 block text-sm">
            Notes
            <textarea
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div>
            <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
              Save interview
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-8 flex items-center gap-3 text-sm">
        <label>
          Month
          <input
            className="ml-2 border border-stone-300 px-2 py-1"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-px border border-stone-300 bg-stone-300">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="bg-stone-50 px-2 py-1 text-xs font-medium">
            {day}
          </div>
        ))}
        {days.map((day, index) => {
          const key = day ? localDateKey(day) : null
          const events = key ? byDay.get(key) ?? [] : []
          return (
            <div key={key ?? `empty-${index}`} className="min-h-24 bg-white p-2 text-xs">
              {day ? <p className="text-stone-500">{day.getDate()}</p> : null}
              {events.map((event) => (
                <p key={event.id} className="mt-1 truncate text-stone-800">
                  {event.company}
                </p>
              ))}
            </div>
          )
        })}
      </div>

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Candidate</th>
              <th className="px-4 py-2 font-medium">Company</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Result</th>
              {isStaff ? <th className="px-4 py-2 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-stone-200">
                <td className="px-4 py-2">
                  {new Date(item.startsAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">{item.profileName ?? '—'}</td>
                <td className="px-4 py-2">{item.company}</td>
                <td className="px-4 py-2">{item.jobTitle}</td>
                <td className="px-4 py-2">{item.result ?? '—'}</td>
                {isStaff ? (
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="border border-stone-400 px-2 py-1"
                      onClick={async () => {
                        setError('')
                        try {
                          await api.delete(`/interviews/${item.id}`)
                          await load()
                        } catch (err) {
                          setError(getApiErrorMessage(err))
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function calendarDays(month: string): (Date | null)[] {
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(year, mon - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, mon, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i += 1) {
    cells.push(null)
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, mon - 1, day))
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}
