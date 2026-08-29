import { type FormEvent, useEffect, useMemo, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { CandidateProfile, Education, User, WorkExperience } from '../api/types'
import { useAuth } from '../auth/AuthContext'

const emptyCreate = {
  profileName: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
}

export function CandidatesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [create, setCreate] = useState(emptyCreate)
  const [attachUserId, setAttachUserId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const selected = useMemo(
    () => profiles.find((row) => row.id === selectedId) ?? null,
    [profiles, selectedId],
  )

  async function load() {
    const { data } = await api.get<CandidateProfile[]>('/bidder-profiles')
    setProfiles(data)
    if (isAdmin) {
      const { data: userRows } = await api.get<User[]>('/users')
      setUsers(userRows)
    }
  }

  useEffect(() => {
    load().catch((err) => setError(getApiErrorMessage(err)))
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const { data } = await api.post<CandidateProfile>('/bidder-profiles', {
        ...create,
        middleName: create.middleName || undefined,
      })
      setCreate(emptyCreate)
      await load()
      setSelectedId(data.id)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function onAttach(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) {
      return
    }
    setError('')
    try {
      await api.patch(`/users/${attachUserId}/bidder-profile`, {
        bidderProfileId: selectedId,
      })
      setAttachUserId('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const unlinkedBidders = users.filter(
    (row) => row.role === 'BIDDER' && !row.bidderProfileId,
  )

  return (
    <section>
      <h1 className="text-2xl font-medium">Candidates</h1>
      <p className="mt-1 text-sm text-stone-600">
        Profiles used by bidders when applying to jobs.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {isAdmin ? (
        <form
          onSubmit={onCreate}
          className="mt-6 grid max-w-5xl grid-cols-1 gap-3 border border-stone-300 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <h2 className="sm:col-span-2 lg:col-span-3 text-sm font-medium">
            New candidate
          </h2>
          <Field
            label="Profile name"
            value={create.profileName}
            onChange={(value) => setCreate({ ...create, profileName: value })}
            required
          />
          <Field
            label="First name"
            value={create.firstName}
            onChange={(value) => setCreate({ ...create, firstName: value })}
            required
          />
          <Field
            label="Middle name"
            value={create.middleName}
            onChange={(value) => setCreate({ ...create, middleName: value })}
          />
          <Field
            label="Last name"
            value={create.lastName}
            onChange={(value) => setCreate({ ...create, lastName: value })}
            required
          />
          <Field
            label="Email"
            type="email"
            value={create.email}
            onChange={(value) => setCreate({ ...create, email: value })}
            required
          />
          <Field
            label="Phone"
            value={create.phoneNumber}
            onChange={(value) => setCreate({ ...create, phoneNumber: value })}
            required
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Create profile
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Profile</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Assigned bidder</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr
                key={profile.id}
                className={`cursor-pointer border-t border-stone-200 ${
                  selectedId === profile.id ? 'bg-stone-100' : ''
                }`}
                onClick={() => setSelectedId(profile.id)}
              >
                <td className="px-4 py-2">{profile.profileName}</td>
                <td className="px-4 py-2">
                  {[profile.firstName, profile.lastName]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </td>
                <td className="px-4 py-2">
                  {profile.assignedUser
                    ? `${profile.assignedUser.name} (${profile.assignedUser.email})`
                    : 'Unassigned'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">No candidates yet.</p>
        ) : null}
      </div>

      {selected && isAdmin ? (
        <form onSubmit={onAttach} className="mt-6 max-w-xl border border-stone-300 bg-white p-5">
          <h2 className="text-sm font-medium">
            Assign bidder to {selected.profileName}
          </h2>
          <select
            className="mt-3 w-full border border-stone-300 px-3 py-2"
            value={attachUserId}
            onChange={(e) => setAttachUserId(e.target.value)}
            required
          >
            <option value="">Select unlinked BIDDER</option>
            {unlinkedBidders.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({row.email})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white"
          >
            Attach
          </button>
        </form>
      ) : null}

      {selected ? (
        <CandidateEditor
          profile={selected}
          canEdit={isAdmin}
          showSensitive={isAdmin}
          onError={setError}
          onSaved={async () => {
            await load()
          }}
        />
      ) : null}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  type?: string
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className="mt-1 w-full border border-stone-300 px-3 py-2"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  )
}

export function CandidateEditor({
  profile,
  canEdit,
  showSensitive,
  onError,
  onSaved,
}: {
  profile: CandidateProfile
  canEdit: boolean
  showSensitive: boolean
  onError: (message: string) => void
  onSaved: () => Promise<void>
}) {
  const [form, setSet] = useState(profile)

  useEffect(() => {
    setSet(profile)
  }, [profile])

  async function saveBasic(event: FormEvent) {
    event.preventDefault()
    onError('')
    try {
      await api.patch(`/bidder-profiles/${profile.id}`, {
        profileName: form.profileName,
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth,
        streetAddress: form.streetAddress,
        city: form.city,
        stateRegion: form.stateRegion,
        zipPostalCode: form.zipPostalCode,
        linkedinUrl: form.linkedinUrl,
        githubUrl: form.githubUrl,
        portfolioUrl: form.portfolioUrl,
        raceEthnicity: form.raceEthnicity,
        veteranStatus: form.veteranStatus,
        disabilityStatus: form.disabilityStatus,
      })
      await onSaved()
    } catch (err) {
      onError(getApiErrorMessage(err))
    }
  }

  function set(key: keyof CandidateProfile, value: string) {
    setSet((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="mt-8 space-y-8">
      <form
        onSubmit={canEdit ? saveBasic : (event) => event.preventDefault()}
        className="grid max-w-5xl grid-cols-1 gap-3 border border-stone-300 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <h2 className="sm:col-span-2 lg:col-span-3 text-lg font-medium">
          Basic profile information
        </h2>
        <Field
          label="Profile name"
          value={form.profileName}
          onChange={(value) => set('profileName', value)}
        />
        <Field
          label="First name"
          value={form.firstName ?? ''}
          onChange={(value) => set('firstName', value)}
        />
        <Field
          label="Middle name"
          value={form.middleName ?? ''}
          onChange={(value) => set('middleName', value)}
        />
        <Field
          label="Last name"
          value={form.lastName ?? ''}
          onChange={(value) => set('lastName', value)}
        />
        <Field
          label="Email"
          type="email"
          value={form.email ?? ''}
          onChange={(value) => set('email', value)}
        />
        <Field
          label="Phone"
          value={form.phoneNumber ?? ''}
          onChange={(value) => set('phoneNumber', value)}
        />
        <Field
          label="Gender"
          value={form.gender ?? ''}
          onChange={(value) => set('gender', value)}
        />
        {showSensitive ? (
          <>
            <Field
              label="Date of birth"
              type="date"
              value={form.dateOfBirth ?? ''}
              onChange={(value) => set('dateOfBirth', value)}
            />
            <Field
              label="Street address"
              value={form.streetAddress ?? ''}
              onChange={(value) => set('streetAddress', value)}
            />
          </>
        ) : null}
        <Field
          label="City"
          value={form.city ?? ''}
          onChange={(value) => set('city', value)}
        />
        <Field
          label="State / region"
          value={form.stateRegion ?? ''}
          onChange={(value) => set('stateRegion', value)}
        />
        <Field
          label="ZIP / postal code"
          value={form.zipPostalCode ?? ''}
          onChange={(value) => set('zipPostalCode', value)}
        />
        <Field
          label="LinkedIn URL"
          value={form.linkedinUrl ?? ''}
          onChange={(value) => set('linkedinUrl', value)}
        />
        <Field
          label="GitHub URL"
          value={form.githubUrl ?? ''}
          onChange={(value) => set('githubUrl', value)}
        />
        <Field
          label="Portfolio URL"
          value={form.portfolioUrl ?? ''}
          onChange={(value) => set('portfolioUrl', value)}
        />
        {showSensitive ? (
          <>
            <Field
              label="Race / ethnicity"
              value={form.raceEthnicity ?? ''}
              onChange={(value) => set('raceEthnicity', value)}
            />
            <Field
              label="Veteran status"
              value={form.veteranStatus ?? ''}
              onChange={(value) => set('veteranStatus', value)}
            />
            <Field
              label="Disability status"
              value={form.disabilityStatus ?? ''}
              onChange={(value) => set('disabilityStatus', value)}
            />
          </>
        ) : (
          <p className="sm:col-span-2 lg:col-span-3 text-sm text-stone-500">
            Sensitive demographic and address fields are hidden for this role.
          </p>
        )}
        {canEdit ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="bg-stone-900 px-4 py-2 text-sm text-white"
            >
              Save basic information
            </button>
          </div>
        ) : null}
      </form>

      <WorkSection
        profile={profile}
        canEdit={canEdit}
        onError={onError}
        onSaved={onSaved}
      />
      <EducationSection
        profile={profile}
        canEdit={canEdit}
        onError={onError}
        onSaved={onSaved}
      />
    </div>
  )
}

function WorkSection({
  profile,
  canEdit,
  onError,
  onSaved,
}: {
  profile: CandidateProfile
  canEdit: boolean
  onError: (message: string) => void
  onSaved: () => Promise<void>
}) {
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [current, setCurrent] = useState(false)

  async function addJob(event: FormEvent) {
    event.preventDefault()
    onError('')
    try {
      await api.post(`/bidder-profiles/${profile.id}/experiences`, {
        companyName,
        industry: industry || undefined,
        city: city || undefined,
        state: state || undefined,
        startDate,
        endDate: current ? null : endDate || undefined,
        currentlyWorksHere: current,
      })
      setCompanyName('')
      setIndustry('')
      setCity('')
      setState('')
      setStartDate('')
      setEndDate('')
      setCurrent(false)
      await onSaved()
    } catch (err) {
      onError(getApiErrorMessage(err))
    }
  }

  return (
    <div className="max-w-5xl border border-stone-300 bg-white p-5">
      <h2 className="text-lg font-medium">Work experience</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {profile.experiences.map((job) => (
          <JobRow
            key={job.id}
            profileId={profile.id}
            job={job}
            canEdit={canEdit}
            onError={onError}
            onSaved={onSaved}
          />
        ))}
      </ul>
      {canEdit ? (
        <form onSubmit={addJob} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Company" value={companyName} onChange={setCompanyName} required />
          <Field label="Industry" value={industry} onChange={setIndustry} />
          <Field label="City" value={city} onChange={setCity} />
          <Field label="State" value={state} onChange={setState} />
          <Field
            label="Start date"
            type="date"
            value={startDate}
            onChange={setStartDate}
            required
          />
          <Field
            label="End date"
            type="date"
            value={endDate}
            onChange={setEndDate}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={current}
              onChange={(e) => setCurrent(e.target.checked)}
            />
            Currently works here
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
              Add job
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function EducationSection({
  profile,
  canEdit,
  onError,
  onSaved,
}: {
  profile: CandidateProfile
  canEdit: boolean
  onError: (message: string) => void
  onSaved: () => Promise<void>
}) {
  const [institutionName, setInstitutionName] = useState('')
  const [degree, setDegree] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function addSchool(event: FormEvent) {
    event.preventDefault()
    onError('')
    try {
      await api.post(`/bidder-profiles/${profile.id}/educations`, {
        institutionName,
        degree: degree || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setInstitutionName('')
      setDegree('')
      setFromDate('')
      setToDate('')
      await onSaved()
    } catch (err) {
      onError(getApiErrorMessage(err))
    }
  }

  return (
    <div className="max-w-5xl border border-stone-300 bg-white p-5">
      <h2 className="text-lg font-medium">Education</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {profile.educations.map((school) => (
          <SchoolRow
            key={school.id}
            profileId={profile.id}
            school={school}
            canEdit={canEdit}
            onError={onError}
            onSaved={onSaved}
          />
        ))}
      </ul>
      {canEdit ? (
        <form onSubmit={addSchool} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="School"
            value={institutionName}
            onChange={setInstitutionName}
            required
          />
          <Field label="Degree" value={degree} onChange={setDegree} />
          <Field
            label="From"
            type="date"
            value={fromDate}
            onChange={setFromDate}
          />
          <Field label="To" type="date" value={toDate} onChange={setToDate} />
          <div className="sm:col-span-2">
            <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
              Add school
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

function JobRow({
  profileId,
  job,
  canEdit,
  onError,
  onSaved,
}: {
  profileId: number
  job: WorkExperience
  canEdit: boolean
  onError: (message: string) => void
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [companyName, setCompanyName] = useState(job.companyName)
  const [industry, setIndustry] = useState(job.industry ?? '')
  const [city, setCity] = useState(job.city ?? '')
  const [state, setState] = useState(job.state ?? '')
  const [startDate, setStartDate] = useState(job.startDate)
  const [endDate, setEndDate] = useState(job.endDate ?? '')
  const [current, setCurrent] = useState(job.currentlyWorksHere)

  useEffect(() => {
    setCompanyName(job.companyName)
    setIndustry(job.industry ?? '')
    setCity(job.city ?? '')
    setState(job.state ?? '')
    setStartDate(job.startDate)
    setEndDate(job.endDate ?? '')
    setCurrent(job.currentlyWorksHere)
  }, [job])

  if (!editing) {
    return (
      <li className="flex items-start justify-between gap-4 border border-stone-200 px-3 py-3">
        <div>
          <p className="font-medium">{job.companyName}</p>
          <p className="text-stone-600">
            {[job.industry, job.city, job.state].filter(Boolean).join(' · ')}
          </p>
          <p className="text-stone-500">
            {job.startDate}
            {' → '}
            {job.currentlyWorksHere ? 'Present' : job.endDate || '—'}
          </p>
        </div>
        {canEdit ? (
          <span className="flex gap-2">
            <button
              type="button"
              className="border border-stone-400 px-2 py-1"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="border border-stone-400 px-2 py-1"
              onClick={async () => {
                onError('')
                try {
                  await api.delete(
                    `/bidder-profiles/${profileId}/experiences/${job.id}`,
                  )
                  await onSaved()
                } catch (err) {
                  onError(getApiErrorMessage(err))
                }
              }}
            >
              Delete
            </button>
          </span>
        ) : null}
      </li>
    )
  }

  return (
    <li className="border border-stone-200 p-3">
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault()
          onError('')
          try {
            await api.patch(
              `/bidder-profiles/${profileId}/experiences/${job.id}`,
              {
                companyName,
                industry: industry || null,
                city: city || null,
                state: state || null,
                startDate,
                endDate: current ? null : endDate || null,
                currentlyWorksHere: current,
              },
            )
            setEditing(false)
            await onSaved()
          } catch (err) {
            onError(getApiErrorMessage(err))
          }
        }}
      >
        <Field label="Company" value={companyName} onChange={setCompanyName} required />
        <Field label="Industry" value={industry} onChange={setIndustry} />
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={state} onChange={setState} />
        <Field
          label="Start date"
          type="date"
          value={startDate}
          onChange={setStartDate}
          required
        />
        <Field label="End date" type="date" value={endDate} onChange={setEndDate} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => setCurrent(e.target.checked)}
          />
          Currently works here
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button type="submit" className="bg-stone-900 px-3 py-1 text-sm text-white">
            Save
          </button>
          <button
            type="button"
            className="border border-stone-400 px-2 py-1 text-sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  )
}

function SchoolRow({
  profileId,
  school,
  canEdit,
  onError,
  onSaved,
}: {
  profileId: number
  school: Education
  canEdit: boolean
  onError: (message: string) => void
  onSaved: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [institutionName, setInstitutionName] = useState(school.institutionName)
  const [degree, setDegree] = useState(school.degree ?? '')
  const [fromDate, setFromDate] = useState(school.fromDate ?? '')
  const [toDate, setToDate] = useState(school.toDate ?? '')

  useEffect(() => {
    setInstitutionName(school.institutionName)
    setDegree(school.degree ?? '')
    setFromDate(school.fromDate ?? '')
    setToDate(school.toDate ?? '')
  }, [school])

  if (!editing) {
    return (
      <li className="flex items-start justify-between gap-4 border border-stone-200 px-3 py-3">
        <div>
          <p className="font-medium">{school.institutionName}</p>
          <p className="text-stone-600">{school.degree || '—'}</p>
          <p className="text-stone-500">
            {school.fromDate || '—'} → {school.toDate || '—'}
          </p>
        </div>
        {canEdit ? (
          <span className="flex gap-2">
            <button
              type="button"
              className="border border-stone-400 px-2 py-1"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className="border border-stone-400 px-2 py-1"
              onClick={async () => {
                onError('')
                try {
                  await api.delete(
                    `/bidder-profiles/${profileId}/educations/${school.id}`,
                  )
                  await onSaved()
                } catch (err) {
                  onError(getApiErrorMessage(err))
                }
              }}
            >
              Delete
            </button>
          </span>
        ) : null}
      </li>
    )
  }

  return (
    <li className="border border-stone-200 p-3">
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault()
          onError('')
          try {
            await api.patch(
              `/bidder-profiles/${profileId}/educations/${school.id}`,
              {
                institutionName,
                degree: degree || null,
                fromDate: fromDate || null,
                toDate: toDate || null,
              },
            )
            setEditing(false)
            await onSaved()
          } catch (err) {
            onError(getApiErrorMessage(err))
          }
        }}
      >
        <Field
          label="School"
          value={institutionName}
          onChange={setInstitutionName}
          required
        />
        <Field label="Degree" value={degree} onChange={setDegree} />
        <Field label="From" type="date" value={fromDate} onChange={setFromDate} />
        <Field label="To" type="date" value={toDate} onChange={setToDate} />
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="bg-stone-900 px-3 py-1 text-sm text-white">
            Save
          </button>
          <button
            type="button"
            className="border border-stone-400 px-2 py-1 text-sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  )
}

