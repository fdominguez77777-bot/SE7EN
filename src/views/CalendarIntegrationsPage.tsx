import { useEffect, useState } from 'react'
import { Link } from '@/lib/navigation'
import { CalendarDays, Copy, RefreshCw, Trash2 } from 'lucide-react'

import { api, getApiErrorMessage } from '../api/client'
import type { CalendarAccount, CalendarBidder, CalendarConnectLink } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, SectionCard } from '../ui/chrome'
import { useConfirmDialog } from '../ui/confirm-dialog'

function personOptionLabel(person: CalendarBidder, meId: number | undefined) {
  return person.id === meId ? `${person.name} (you)` : person.name
}

export function CalendarIntegrationsPage() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirmDialog()
  const canManage = user?.role === 'ADMIN'
  const [accounts, setAccounts] = useState<CalendarAccount[]>([])
  const [bidders, setBidders] = useState<CalendarBidder[]>([])
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [link, setLink] = useState<CalendarConnectLink | null>(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    setError('')
    const [{ data }, { data: bidderRows }] = await Promise.all([
      api.get<CalendarAccount[]>('/calendar/accounts'),
      api.get<CalendarBidder[]>('/calendar/bidders'),
    ])
    setAccounts(data)
    setBidders(bidderRows)
    setDrafts(
      Object.fromEntries(
        data.map((row) => [row.id, row.assignedBidderId ? String(row.assignedBidderId) : '']),
      ),
    )
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  async function createLink(provider: 'google' | 'microsoft') {
    setError('')
    setNotice('')
    try {
      const { data } = await api.post<CalendarConnectLink>(
        `/calendar/accounts/${provider}/link`,
        {},
      )
      setLink(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  async function remove(id: number) {
    ask({
      title: 'Disconnect calendar?',
      description: 'Events from this account will stop appearing on Interviews.',
      confirmLabel: 'Disconnect',
      action: async () => {
        await api.delete(`/calendar/accounts/${id}`)
        await load()
      },
    })
  }

  async function resetAll() {
    ask({
      title: 'Reset all calendars?',
      description: 'This disconnects every Google and Microsoft calendar.',
      confirmLabel: 'Reset all',
      action: async () => {
        await api.post('/calendar/accounts/reset')
        await load()
      },
    })
  }

  async function assignBidder(accountId: number) {
    setError('')
    setNotice('')
    setSavingId(accountId)
    try {
      const assignedBidderId = drafts[accountId] ?? ''
      const { data } = await api.patch<CalendarAccount[]>(`/calendar/accounts/${accountId}`, {
        assignedBidderId: assignedBidderId ? Number(assignedBidderId) : null,
      })
      setAccounts(data)
      setDrafts(
        Object.fromEntries(
          data.map((row) => [row.id, row.assignedBidderId ? String(row.assignedBidderId) : '']),
        ),
      )
      setNotice('Assignment saved. A person can have more than one Gmail.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setSavingId(null)
    }
  }

  async function copyLink() {
    if (!link) {
      return
    }
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="apps-page">
      {dialog}
      <p className="apps-crumb">Operations &gt; Interviews &gt; Calendars</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
            Connected calendars
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Link Gmails to you, a bid manager, or a bidder. The same person can have several
            calendars — assign each Gmail to them and Save. If Google says insufficient scopes,
            disconnect the account and Add Google Calendar again.
          </p>
        </div>
        <Link to="/interviews" className="text-[13px] font-semibold text-[var(--accent)]">
          Back to interviews
        </Link>
      </div>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <p className="mt-4 text-[13px] text-[var(--text-secondary)]">{notice}</p>
      ) : null}

      <SectionCard
        className="mt-5"
        title="Connected calendars"
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button variant="danger" onClick={() => void resetAll()} disabled={!accounts.length}>
                <Trash2 className="h-4 w-4" />
                Reset All
              </Button>
            </div>
          ) : null
        }
      >
        {loading ? (
          <p className="text-[13px] text-[var(--text-muted)]">Loading calendars…</p>
        ) : accounts.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No calendars connected yet.</p>
        ) : (
          <div className="cal-int-grid">
            {accounts.map((account) => (
              <div key={account.id} className="cal-int-card">
                <CalendarDays className="h-5 w-5 text-[var(--text-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text-primary)]">
                    {account.displayName}
                  </p>
                  <p className="truncate text-[12px] text-[var(--text-muted)]">{account.email}</p>
                  {canManage ? (
                    <div className="cal-assign">
                      <select
                        className="input-field"
                        value={drafts[account.id] ?? ''}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [account.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Unassigned</option>
                        {bidders.some((row) => row.id === user?.id) ? (
                          <optgroup label="You">
                            {bidders
                              .filter((row) => row.id === user?.id)
                              .map((row) => (
                                <option key={row.id} value={String(row.id)}>
                                  {personOptionLabel(row, user?.id)}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                        {bidders.some((row) => row.role === 'ADMIN' && row.id !== user?.id) ? (
                          <optgroup label="Admins">
                            {bidders
                              .filter((row) => row.role === 'ADMIN' && row.id !== user?.id)
                              .map((row) => (
                                <option key={row.id} value={String(row.id)}>
                                  {row.name}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                        {bidders.some((row) => row.role === 'BID_MANAGER' && row.id !== user?.id) ? (
                          <optgroup label="Bid managers">
                            {bidders
                              .filter((row) => row.role === 'BID_MANAGER' && row.id !== user?.id)
                              .map((row) => (
                                <option key={row.id} value={String(row.id)}>
                                  {row.name}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                        {bidders.some((row) => row.role === 'BIDDER') ? (
                          <optgroup label="Bidders">
                            {bidders
                              .filter((row) => row.role === 'BIDDER')
                              .map((row) => (
                                <option key={row.id} value={String(row.id)}>
                                  {row.name}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                      </select>
                      <Button
                        onClick={() => void assignBidder(account.id)}
                        disabled={
                          savingId === account.id ||
                          (drafts[account.id] ?? '') ===
                            (account.assignedBidderId ? String(account.assignedBidderId) : '')
                        }
                      >
                        {savingId === account.id ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  ) : account.assignedBidderName ? (
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {account.assignedBidderName}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="cal-trash"
                    aria-label={`Disconnect ${account.email}`}
                    onClick={() => void remove(account.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {canManage ? (
          <div className="cal-int-actions">
            <Button className="flex-1" variant="secondary" onClick={() => void createLink('google')}>
              Add Google Calendar
            </Button>
            <Button className="flex-1" variant="secondary" onClick={() => void createLink('microsoft')}>
              Add Microsoft Calendar
            </Button>
          </div>
        ) : null}
      </SectionCard>

      {link ? (
        <div className="apps-modal" onClick={() => setLink(null)} role="presentation">
          <div
            className="apps-modal-panel cal-link-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-[22px] py-5">
              <h2 className="text-[22px] font-bold text-[var(--text-primary)]">
                Add {link.provider === 'MICROSOFT' ? 'Microsoft' : 'Google'} Calendar
              </h2>
              <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                Copy this link once and reuse it for every Gmail. After each connect, open it again
                and choose a different Google account. You can also use a separate browser profile
                if that inbox is already signed in somewhere else.
              </p>
              <label className="mt-4 block text-[12px] font-semibold text-[var(--text-muted)]">
                Connection link
                <input className="input-field mt-1" readOnly value={link.url} />
              </label>
              <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                This link expires on {new Date(link.expiresAt).toLocaleString()}.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setLink(null)}>
                  Close
                </Button>
                <Button onClick={() => void copyLink()}>
                  <Copy className="h-4 w-4" />
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
