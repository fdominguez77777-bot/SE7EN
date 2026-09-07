import { type FormEvent, useEffect, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  BidderCompensationRate,
  IndividualBidderRateConfig,
  ManagerSalaryRow,
  User,
} from '../api/types'
import { Alert, Button, SectionCard } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { CardSkeleton } from '../ui/loading/page-skeletons'
import { formatUsd } from '../ui/money'
import { PageHeader } from '../ui/page-header'
import { toIsoDate } from '../ui/reporting-period'

const DEFAULT_MANAGER_WEEKLY_SALARY = '70.00'
const MANAGER_SALARY_DEFAULT_KEY = 'compensation.managerWeeklySalaryDefault'

function readManagerSalaryDefault() {
  try {
    const saved = localStorage.getItem(MANAGER_SALARY_DEFAULT_KEY)
    const amount = Number(saved)
    if (saved && Number.isFinite(amount) && amount >= 0) {
      return amount.toFixed(2)
    }
  } catch {
    /* keep built-in default */
  }
  return DEFAULT_MANAGER_WEEKLY_SALARY
}

function writeManagerSalaryDefault(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    return
  }
  try {
    localStorage.setItem(MANAGER_SALARY_DEFAULT_KEY, amount.toFixed(2))
  } catch {
    /* ignore quota / private mode */
  }
}

export function CompensationSettingsPage() {
  const [rates, setRates] = useState<BidderCompensationRate[]>([])
  const [managers, setManagerRows] = useState<ManagerSalaryRow[]>([])
  const [managerUsers, setManagerUsers] = useState<User[]>([])
  const [bidders, setBidders] = useState<User[]>([])
  const [individualBidderId, setIndividualBidderId] = useState('')
  const [individualConfig, setIndividualConfig] =
    useState<IndividualBidderRateConfig | null>(null)
  const [individualApplicationRate, setIndividualApplicationRate] = useState('0.03')
  const [individualInterviewRate, setIndividualInterviewRate] = useState('1.00')
  const [individualFrom, setIndividualFrom] = useState(toIsoDate(new Date()))
  const [individualNotes, setIndividualNotes] = useState('')
  const [returnToDefaultOn, setReturnToDefaultOn] = useState(toIsoDate(new Date()))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [applicationRate, setApplicationRate] = useState('0.03')
  const [interviewRate, setInterviewRate] = useState('1.00')
  const [rateFrom, setRateFrom] = useState(toIsoDate(new Date()))
  const [managerId, setManagerId] = useState('')
  const [weeklySalary, setWeeklySalary] = useState(readManagerSalaryDefault)
  const [salaryFrom, setSalaryFrom] = useState(toIsoDate(new Date()))
  const [pending, setPending] = useState(false)

  async function load() {
    const [{ data: rateRows }, { data: salaryRows }, { data: users }, { data: bidderRows }] =
      await Promise.all([
        api.get<BidderCompensationRate[]>('/compensation/rates'),
        api.get<ManagerSalaryRow[]>('/compensation/manager-salaries'),
        api.get<User[]>('/users/managers'),
        api.get<User[]>('/users/bidders'),
      ])
    setRates(rateRows)
    setManagerRows(salaryRows)
    setManagerUsers(users)
    setBidders(bidderRows)
    const current = rateRows[0]
    if (current) {
      setApplicationRate(String(Number(current.applicationRate)))
      setInterviewRate(String(Number(current.interviewRate)))
    }
    if (!managerId && users[0]) {
      setManagerId(String(users[0].id))
    }
    if (!individualBidderId && bidderRows[0]) {
      setIndividualBidderId(String(bidderRows[0].id))
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const current = rates[0]

  useEffect(() => {
    if (!individualBidderId) {
      setIndividualConfig(null)
      return
    }
    api
      .get<IndividualBidderRateConfig>(
        `/compensation/bidder-rates/${individualBidderId}`,
      )
      .then(({ data }) => {
        setIndividualConfig(data)
        if (data.resolved) {
          setIndividualApplicationRate(String(Number(data.resolved.applicationRate)))
          setIndividualInterviewRate(String(Number(data.resolved.interviewRate)))
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
  }, [individualBidderId])

  async function saveRates(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      await api.post('/compensation/rates', {
        applicationRate,
        interviewRate,
        effectiveFrom: new Date(`${rateFrom}T00:00:00`).toISOString(),
      })
      setNotice('Bidder rates updated. Existing reviewed/paid weeks are unchanged.')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function saveIndividualRates(event: FormEvent) {
    event.preventDefault()
    if (!individualBidderId) {
      return
    }
    setError('')
    setNotice('')
    setPending(true)
    try {
      await api.post(`/compensation/bidder-rates/${individualBidderId}`, {
        applicationRate: individualApplicationRate,
        interviewRate: individualInterviewRate,
        effectiveFrom: new Date(`${individualFrom}T00:00:00`).toISOString(),
        notes: individualNotes.trim() || undefined,
      })
      setNotice('Individual bidder rates updated. Existing reviewed/paid weeks are unchanged.')
      setIndividualNotes('')
      const { data } = await api.get<IndividualBidderRateConfig>(
        `/compensation/bidder-rates/${individualBidderId}`,
      )
      setIndividualConfig(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function returnToDefault() {
    if (!individualBidderId) {
      return
    }
    setError('')
    setNotice('')
    setPending(true)
    try {
      const { data } = await api.post<IndividualBidderRateConfig>(
        `/compensation/bidder-rates/${individualBidderId}/end`,
        {
          effectiveTo: new Date(`${returnToDefaultOn}T00:00:00`).toISOString(),
        },
      )
      setIndividualConfig(data)
      if (data.resolved) {
        setIndividualApplicationRate(String(Number(data.resolved.applicationRate)))
        setIndividualInterviewRate(String(Number(data.resolved.interviewRate)))
      }
      setNotice('Individual override ended. Later weeks use default bidder rates.')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function saveSalary(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      await api.post('/compensation/manager-salaries', {
        managerId: Number(managerId),
        weeklySalary,
        effectiveFrom: new Date(`${salaryFrom}T00:00:00`).toISOString(),
      })
      writeManagerSalaryDefault(weeklySalary)
      const nextDefault = readManagerSalaryDefault()
      setWeeklySalary(nextDefault)
      setNotice('Manager salary updated. Historic weekly snapshots stay unchanged.')
      await load()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <section>
      <PageHeader
        eyebrow="Admin"
        title="Compensation"
        description="Configure bidder performance rates and bid manager weekly salaries."
      />

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <SectionCard
            className="mt-6"
            title="Default bidder rates"
            description="Bidders have no weekly base salary. Bidders without an individual override use these rates."
          >
            {current ? (
              <div className="mt-1 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--border-glass)] bg-white/[0.04] px-4 py-3">
                  <p className="text-xs text-[var(--text-secondary)]">Application rate</p>
                  <p className="num-metric mt-1 text-2xl">
                    {formatUsd(current.applicationRate)}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-glass)] bg-white/[0.04] px-4 py-3">
                  <p className="text-xs text-[var(--text-secondary)]">Interview rate</p>
                  <p className="num-metric mt-1 text-2xl">
                    {formatUsd(current.interviewRate)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <EmptyState title="No bidder rates are configured yet." />
              </div>
            )}
            <form onSubmit={saveRates} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Application rate</span>
                <input
                  className="input-field"
                  value={applicationRate}
                  onChange={(e) => setApplicationRate(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Interview schedule rate</span>
                <input
                  className="input-field"
                  value={interviewRate}
                  onChange={(e) => setInterviewRate(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Effective from</span>
                <input
                  className="input-field"
                  type="date"
                  value={rateFrom}
                  onChange={(e) => setRateFrom(e.target.value)}
                  required
                />
              </label>
              <div className="md:col-span-3">
                <Button type="submit" disabled={pending}>
                  Save bidder rates
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            className="mt-6"
            title="Individual bidder rates"
            description="Set custom performance rates for a specific bidder. Bidders without an individual rate use the default rates above."
          >
            {bidders.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No bidder users exist yet." />
              </div>
            ) : (
              <>
                <form
                  onSubmit={saveIndividualRates}
                  className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  <label className="text-sm md:col-span-2">
                    <span className="text-[var(--text-secondary)]">Bidder</span>
                    <select
                      className="input-field"
                      value={individualBidderId}
                      onChange={(e) => setIndividualBidderId(e.target.value)}
                      required
                    >
                      <option value="">Select</option>
                      {bidders.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} — {row.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  {individualConfig?.resolved ? (
                    <div className="md:col-span-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className={`rounded-lg border px-4 py-3 ${individualConfig.source === 'default' ? 'border-[rgba(111,189,140,0.32)] bg-[rgba(111,189,140,0.08)]' : 'border-[var(--border-glass)] bg-white/5'}`}>
                        <p className="text-xs font-medium text-[var(--text-muted)]">Default</p>
                        <p className="mt-1 text-lg font-semibold">
                          {current
                            ? `${formatUsd(current.applicationRate)} / ${formatUsd(current.interviewRate)}`
                            : '—'}
                        </p>
                        {individualConfig.source === 'default' ? (
                          <p className="mt-1 text-xs text-[var(--semantic-success)]">Active</p>
                        ) : null}
                      </div>
                      <div className={`rounded-lg border px-4 py-3 ${individualConfig.source === 'individual' ? 'border-[rgba(111,189,140,0.32)] bg-[rgba(111,189,140,0.08)]' : 'border-[var(--border-glass)] bg-white/5'}`}>
                        <p className="text-xs font-medium text-[var(--text-muted)]">Individual</p>
                        <p className="mt-1 text-lg font-semibold">
                          {formatUsd(individualConfig.resolved.applicationRate)} /{' '}
                          {formatUsd(individualConfig.resolved.interviewRate)}
                        </p>
                        {individualConfig.source === 'individual' ? (
                          <p className="mt-1 text-xs text-[var(--semantic-success)]">Active</p>
                        ) : (
                          <p className="mt-1 text-xs text-[var(--text-muted)]">Using default bidder rates</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                  <label className="text-sm">
                    <span className="text-[var(--text-secondary)]">Application rate</span>
                    <input
                      className="input-field"
                      value={individualApplicationRate}
                      onChange={(e) => setIndividualApplicationRate(e.target.value)}
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-[var(--text-secondary)]">Interview schedule rate</span>
                    <input
                      className="input-field"
                      value={individualInterviewRate}
                      onChange={(e) => setIndividualInterviewRate(e.target.value)}
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-[var(--text-secondary)]">Effective from</span>
                    <input
                      className="input-field"
                      type="date"
                      value={individualFrom}
                      onChange={(e) => setIndividualFrom(e.target.value)}
                      required
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-[var(--text-secondary)]">Notes (optional)</span>
                    <input
                      className="input-field"
                      value={individualNotes}
                      onChange={(e) => setIndividualNotes(e.target.value)}
                    />
                  </label>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={pending || !individualBidderId}>
                      Save bidder rates
                    </Button>
                  </div>
                </form>
                {individualConfig?.source === 'individual' ? (
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="text-sm">
                      <span className="text-[var(--text-secondary)]">Return to default on</span>
                      <input
                        className="mt-1 block rounded-md border border-[var(--border-glass)] px-3 py-2 text-sm"
                        type="date"
                        value={returnToDefaultOn}
                        onChange={(e) => setReturnToDefaultOn(e.target.value)}
                      />
                    </label>
                    <Button variant="secondary" disabled={pending} onClick={() => void returnToDefault()}>
                      Return to default rates
                    </Button>
                  </div>
                ) : null}
                {individualConfig?.history.length ? (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Rate history</h3>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-[var(--border-glass)] text-[var(--text-muted)]">
                          <tr>
                            <th className="py-1.5 pr-3 font-medium">Effective from</th>
                            <th className="py-1.5 pr-3 font-medium">Effective to</th>
                            <th className="py-1.5 pr-3 font-medium">Application rate</th>
                            <th className="py-1.5 font-medium">Interview rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {individualConfig.history.map((row) => (
                            <tr key={row.id} className="border-t border-[var(--border-glass)]">
                              <td className="py-1.5 pr-3">
                                {new Date(row.effectiveFrom).toLocaleDateString()}
                              </td>
                              <td className="py-1.5 pr-3 text-[var(--text-secondary)]">
                                {row.effectiveTo
                                  ? new Date(row.effectiveTo).toLocaleDateString()
                                  : 'Open'}
                              </td>
                              <td className="py-1.5 pr-3">
                                {formatUsd(row.applicationRate)}
                              </td>
                              <td className="py-1.5">
                                {formatUsd(row.interviewRate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>

          <SectionCard
            className="mt-6"
            title="Bid manager salaries"
            description="Fixed weekly salary. No application or interview bonus."
          >
            {managers.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No bid managers exist yet." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border-glass)] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Manager</th>
                      <th className="py-2 pr-4 font-medium">Weekly salary</th>
                      <th className="py-2 pr-4 font-medium">Effective from</th>
                      <th className="py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.map((row) => (
                      <tr key={row.manager.id} className="border-t border-[var(--border-glass)]">
                        <td className="py-2 pr-4">
                          <p className="font-medium">{row.manager.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{row.manager.email}</p>
                        </td>
                        <td className="py-2 pr-4">
                          {row.current ? (
                            <span className="num-metric text-base">
                              {formatUsd(row.current.weeklySalary)}
                              <span className="ml-1 text-xs font-medium text-[var(--text-muted)]">
                                / week
                              </span>
                            </span>
                          ) : (
                            'Not set'
                          )}
                        </td>
                        <td className="py-2 pr-4 text-[var(--text-secondary)]">
                          {row.current
                            ? new Date(row.current.effectiveFrom).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                            onClick={() => {
                              setManagerId(String(row.manager.id))
                              setWeeklySalary(
                                row.current?.weeklySalary ??
                                  readManagerSalaryDefault(),
                              )
                              setSalaryFrom(toIsoDate(new Date()))
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form onSubmit={saveSalary} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Manager</span>
                <select
                  className="input-field"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  required
                >
                  <option value="">Select</option>
                  {managerUsers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Weekly salary</span>
                <input
                  className="input-field"
                  value={weeklySalary}
                  onChange={(e) => setWeeklySalary(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--text-secondary)]">Effective from</span>
                <input
                  className="input-field"
                  type="date"
                  value={salaryFrom}
                  onChange={(e) => setSalaryFrom(e.target.value)}
                  required
                />
              </label>
              <div className="md:col-span-3">
                <Button type="submit" disabled={pending || !managerId}>
                  Save manager salary
                </Button>
              </div>
            </form>
          </SectionCard>
        </>
      )}
    </section>
  )
}
