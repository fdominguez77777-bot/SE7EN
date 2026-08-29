import { useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { CandidateProfile } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CandidateEditor } from './CandidatesPage'

export function MyProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [error, setError] = useState('')

  async function load() {
    if (!user?.bidderProfileId) {
      setProfile(null)
      return
    }
    const { data } = await api.get<CandidateProfile>(
      `/bidder-profiles/${user.bidderProfileId}`,
    )
    setProfile(data)
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [user?.bidderProfileId])

  return (
    <section>
      <h1 className="text-2xl font-medium">My profile</h1>
      <p className="mt-1 text-sm text-stone-600">
        Assigned by an admin. This is the candidate you apply as.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
      {!user?.bidderProfileId ? (
        <p className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          No candidate profile is assigned to your account yet.
        </p>
      ) : null}
      {profile ? (
        <CandidateEditor
          profile={profile}
          canEdit={false}
          showSensitive
          onError={setError}
          onSaved={load}
        />
      ) : null}
    </section>
  )
}
