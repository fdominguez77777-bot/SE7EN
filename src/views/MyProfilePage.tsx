import { useEffect, useState } from 'react'
import { Link } from '@/lib/navigation'

import { api, getApiErrorMessage } from '../api/client'
import type { CandidateProfile, Interview } from '../api/types'
import { CandidateEditor } from './CandidatesPage'
import { EntityAvatar } from '../ui/avatar'
import { Alert, Button } from '../ui/chrome'
import { FunLoader } from '../ui/loading/fun-loader'
import { EmptyState } from '../ui/EmptyState'
import { PageHeader } from '../ui/page-header'
import { candidateFullName } from '../ui/bidder-report'
import { isUpcomingInterview } from '../ui/interview-time'

export function MyProfilePage() {
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const [{ data }, { data: interviewRows }] = await Promise.all([
      api.get<CandidateProfile[]>('/bidder-profiles'),
      api.get<Interview[]>('/interviews'),
    ])
    setProfiles(data)
    setInterviews(interviewRows)
    setSelectedId((current) => {
      if (current && data.some((row) => row.id === current)) {
        return current
      }
      return data[0]?.id ?? null
    })
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const selected = profiles.find((row) => row.id === selectedId) ?? null

  return (
    <section>
      <PageHeader
        eyebrow="My work"
        title="My Profiles"
        description="These are the profiles you are responsible for. They are read-only."
      />
      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {loading ? (
        <FunLoader label="Loading profiles" />
      ) : profiles.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No profiles are currently assigned to your account."
            description="When a bid manager assigns a profile to you, it will appear here."
          />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {profiles.map((profile) => {
              const appCount = profile.applicationCount ?? 0
              const upcomingCount = interviews.filter(
                (row) =>
                  row.candidateProfileId === profile.id && isUpcomingInterview(row),
              ).length
              return (
                <article
                  key={profile.id}
                  className={`glass-clickable rounded-xl border bg-[var(--bg-glass-solid)] px-4 py-3.5 text-left ${
                    profile.id === selectedId
                      ? 'border-[var(--accent-strong)] shadow-[inset_2px_0_0_var(--accent-strong)]'
                      : 'border-[var(--border-glass)]'
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => setSelectedId(profile.id)}
                  >
                    <EntityAvatar name={candidateFullName(profile) || profile.profileName} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                        {profile.profileName}
                      </p>
                      <p className="truncate text-sm text-[var(--text-muted)]">
                        {candidateFullName(profile) || 'Name not completed'}
                      </p>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {appCount} applications · {upcomingCount} upcoming interviews
                      </p>
                    </div>
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-glass)] pt-3">
                    <Button
                      variant="ghost"
                      className="!px-2 !py-1 text-xs"
                      onClick={() => setSelectedId(profile.id)}
                    >
                      View Profile
                    </Button>
                    <Link to={`/applications?candidateId=${profile.id}`}>
                      <Button variant="ghost" className="!px-2 !py-1 text-xs">
                        Applications
                      </Button>
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
          {selected ? (
            <div className="mt-6">
              <CandidateEditor
                profile={selected}
                canEdit={false}
                showSensitive
                onError={setError}
                onSaved={async () => {
                  await load()
                }}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
