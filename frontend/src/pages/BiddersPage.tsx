import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { BidderProfile, User } from '../api/types'
import { useAuth } from '../auth/AuthContext'

export function BiddersPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const isAdmin = user?.role === 'ADMIN'
  const [profiles, setProfiles] = useState<BidderProfile[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [name, setName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [attachUserId, setAttachUserId] = useState('')
  const [attachProfileId, setAttachProfileId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function load() {
    const { data } = await api.get<BidderProfile[]>('/bidder-profiles')
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
      await api.post('/bidder-profiles', {
        name,
        legalName: legalName || undefined,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
      })
      setName('')
      setLegalName('')
      setContactName('')
      setEmail('')
      setPhone('')
      setAddress('')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function onAttach(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.patch(`/users/${attachUserId}/bidder-profile`, {
        bidderProfileId: Number(attachProfileId),
      })
      setAttachUserId('')
      setAttachProfileId('')
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
      <h1 className="text-2xl font-medium">Bidders</h1>
      <p className="mt-1 text-sm text-stone-600">
        Company profiles. Admins can attach a BIDDER login to a profile.
      </p>
      {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}

      {canManage ? (
        <form
          onSubmit={onCreate}
          className="mt-6 max-w-xl border border-stone-300 bg-white p-5"
        >
          <h2 className="text-sm font-medium">New bidder profile</h2>
          <label className="mt-3 block text-sm">
            Company name
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="mt-3 block text-sm">
            Legal name
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            Contact name
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            Email
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            Phone
            <input
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-sm">
            Address
            <textarea
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Create
          </button>
        </form>
      ) : null}

      {isAdmin ? (
        <form
          onSubmit={onAttach}
          className="mt-6 max-w-xl border border-stone-300 bg-white p-5"
        >
          <h2 className="text-sm font-medium">Link BIDDER login to profile</h2>
          <label className="mt-3 block text-sm">
            User
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
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
          </label>
          <label className="mt-3 block text-sm">
            Profile
            <select
              className="mt-1 w-full border border-stone-300 px-3 py-2"
              value={attachProfileId}
              onChange={(e) => setAttachProfileId(e.target.value)}
              required
            >
              <option value="">Select profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="mt-4 bg-stone-900 px-4 py-2 text-sm text-white"
          >
            Attach
          </button>
        </form>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-300 bg-stone-50">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Contact</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-t border-stone-200">
                <td className="px-4 py-2">{profile.name}</td>
                <td className="px-4 py-2">{profile.contactName ?? '—'}</td>
                <td className="px-4 py-2">{profile.email ?? '—'}</td>
                <td className="px-4 py-2">{profile.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {profiles.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-500">No bidders yet.</p>
        ) : null}
      </div>
    </section>
  )
}
