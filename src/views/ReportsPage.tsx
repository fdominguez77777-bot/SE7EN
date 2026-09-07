import { useEffect, useMemo, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type {
  ActivityBidderRow,
  CandidateProfile,
  CompensationWeek,
  User,
} from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, Button, SectionCard, Tabs } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { MetricCard } from '../ui/MetricCard'
import { PageHeader } from '../ui/page-header'
import { PeriodSelector, usePeriodFilter } from '../ui/PeriodSelector'
import { StatusBadge, paymentStatusTone } from '../ui/StatusBadge'
import {
  buildBidderReport,
  reportTotals,
} from '../ui/bidder-report'
import { downloadCsv } from '../ui/csv'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { formatUsd, paymentStatusLabel } from '../ui/money'
import { rangeQuery, toIsoDate } from '../ui/reporting-period'

export function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [bidders, setBidders] = useState<User[]>([])
  const [profiles, setProfiles] = useState<CandidateProfile[]>([])
  const [activity, setActivity] = useState<ActivityBidderRow[]>([])
  const [payments, setPayments] = useState<CompensationWeek | null>(null)
  const [paymentActionId, setPaymentActionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'activity' | 'payments'>('activity')
  const period = usePeriodFilter('today')
  const range = period.range

  useEffect(() => {
    setLoading(true)
    const query = rangeQuery(range)
    Promise.all([
      api.get<User[]>('/users/bidders'),
      api.get<CandidateProfile[]>('/bidder-profiles'),
      api.get<ActivityBidderRow[]>('/activity/summary/bidders', { params: query }),
      api.get<CompensationWeek>('/compensation/week', { params: query }),
    ])
      .then(([bidderRes, profileRes, activityRes, payRes]) => {
        setBidders(bidderRes.data)
        setProfiles(profileRes.data)
        setActivity(activityRes.data)
        setPayments(payRes.data)
        setError('')
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [period.applied])

  const rows = useMemo(
    () =>
      buildBidderReport(bidders, profiles, activity, { includeIdle: false }),
    [bidders, profiles, activity],
  )
  const totals = reportTotals(rows)

  function exportCsv() {
    downloadCsv(`weekly-report-${toIsoDate(range.from)}.csv`, [
      [
        'Week',
        'Bidder',
        'Email',
        'Assigned Profiles',
        'Applications',
        'Interview activity',
        'Resumes',
      ],
      ...rows.map((row) => [
        range.label,
        row.bidder.name,
        row.bidder.email,
        row.candidates.length,
        row.applications,
        row.interviews,
        row.resumes,
      ]),
      [
        range.label,
        'Total',
        '',
        totals.candidates,
        totals.applications,
        totals.interviews,
        totals.resumes,
      ],
    ])
  }

  function exportBidderPayCsv() {
    downloadCsv(`bidder-payments-${toIsoDate(range.from)}.csv`, [
      [
        'Week',
        'Bidder',
        'Applications',
        'Application Rate',
        'Application Pay',
        'Interview Schedules',
        'Interview Rate',
        'Interview Pay',
        'Total Pay',
        'Status',
      ],
      ...(payments?.bidders ?? []).map((row) => [
        range.label,
        row.bidderName || '',
        row.applicationCount,
        row.applicationRate,
        row.applicationPayAmount,
        row.interviewCount,
        row.interviewRate,
        row.interviewPayAmount,
        row.totalAmount,
        row.status,
      ]),
    ])
  }

  function exportManagerPayCsv() {
    downloadCsv(`manager-salaries-${toIsoDate(range.from)}.csv`, [
      ['Week', 'Bid Manager', 'Weekly Salary', 'Total', 'Status'],
      ...(payments?.managers ?? []).map((row) => [
        range.label,
        row.managerName || '',
        row.weeklySalaryRate,
        row.totalAmount,
        row.status,
      ]),
    ])
  }

  async function refreshPayments() {
    const query = rangeQuery(range)
    const { data } = await api.get<CompensationWeek>('/compensation/week', { params: query })
    setPayments(data)
  }

  async function withPaymentAction(key: string, action: () => Promise<void>) {
    setError('')
    setPaymentActionId(key)
    try {
      await action()
      await refreshPayments()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPaymentActionId(null)
    }
  }

  async function reviewBidder(id: number) {
    await withPaymentAction(`review-bidder-${id}`, () =>
      api.post(`/compensation/payments/bidders/${id}/review`).then(() => undefined),
    )
  }

  async function payBidder(id: number) {
    await withPaymentAction(`pay-bidder-${id}`, () =>
      api.post(`/compensation/payments/bidders/${id}/pay`).then(() => undefined),
    )
  }

  async function reviewManager(id: number) {
    await withPaymentAction(`review-manager-${id}`, () =>
      api.post(`/compensation/payments/managers/${id}/review`).then(() => undefined),
    )
  }

  async function payManager(id: number) {
    await withPaymentAction(`pay-manager-${id}`, () =>
      api.post(`/compensation/payments/managers/${id}/pay`).then(() => undefined),
    )
  }

  return (
    <section>
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Reporting week is Monday–Sunday. Standard workdays are Monday–Friday. Weekend work is included when recorded."
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={exportBidderPayCsv} disabled={!payments?.bidders.length}>
              Export bidder pay
            </Button>
            {isAdmin ? (
              <Button variant="secondary" onClick={exportManagerPayCsv} disabled={!payments?.managers.length}>
                Export manager salary
              </Button>
            ) : null}
            <Button onClick={() => window.print()}>Print report</Button>
          </div>
        }
      />

      <div className="mt-5 print:hidden">
        <PeriodSelector
          preset={period.preset}
          fromDate={period.fromDate}
          toDate={period.toDate}
          onPreset={period.onPreset}
          onFromDate={period.setFromDate}
          onToDate={period.setToDate}
          onFilter={period.applyFilter}
          label={range.label}
        />
      </div>
      <p className="mt-2 hidden text-sm text-[var(--text-secondary)] print:block">
        Period: {range.label}
      </p>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <PageSkeleton metrics={4} rows={5} />
        </div>
      ) : (
        <>
          <div className="mt-5 print:hidden">
            <Tabs
              value={tab}
              onChange={(id) => setTab(id as 'activity' | 'payments')}
              items={[
                { id: 'activity', label: 'Activity' },
                { id: 'payments', label: 'Payments' },
              ]}
            />
          </div>
          {tab === 'activity' ? (
            <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard value={totals.bidders} label="Bidders" />
            <MetricCard
              value={totals.candidates}
              label="Assigned profiles"
            />
            <MetricCard
              value={totals.applications}
              label={`Applications · ${range.label}`}
            />
            <MetricCard
              value={totals.interviews}
              label={`Interview activity · ${range.label}`}
            />
          </div>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
            Applications here are activity totals, including manual corrections.
            Detailed Job Application records live on the Applications page and can
            differ.
          </p>

          <SectionCard className="mt-6" title="Bidder activity">
            {rows.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No bidder activity is available for this week." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border-glass)] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Bidder</th>
                      <th className="py-2 pr-4 font-medium">Profiles</th>
                      <th className="py-2 pr-4 font-medium">Applications</th>
                      <th className="py-2 pr-4 font-medium">Interview activity</th>
                      <th className="py-2 font-medium">Resumes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.bidder.id}
                        className="border-t border-[var(--border-glass)]"
                      >
                        <td className="py-2 pr-4">
                          <p className="font-medium text-[var(--text-primary)]">
                            {row.bidder.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {row.bidder.email}
                          </p>
                        </td>
                        <td className="py-2 pr-4">{row.candidates.length}</td>
                        <td className="py-2 pr-4">{row.applications}</td>
                        <td className="py-2 pr-4">{row.interviews}</td>
                        <td className="py-2">{row.resumes}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--border-glass)] font-medium">
                      <td className="py-2 pr-4">Total</td>
                      <td className="py-2 pr-4">{totals.candidates}</td>
                      <td className="py-2 pr-4">{totals.applications}</td>
                      <td className="py-2 pr-4">{totals.interviews}</td>
                      <td className="py-2">{totals.resumes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
            </>
          ) : (
            <>
          <SectionCard
            className="mt-6"
            title="Bidder Performance Pay"
            description="Application activity counts and payable interview schedules. There is no bidder base salary."
          >
            {payments ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <MetricCard
                  value={formatUsd(payments.summary.bidderPayTotal)}
                  label="Bidder performance pay"
                />
                <MetricCard
                  value={formatUsd(payments.summary.managerSalaryTotal)}
                  label="Bid manager fixed salaries"
                />
                <MetricCard
                  value={formatUsd(payments.summary.payrollTotal)}
                  label="Total weekly payroll"
                />
              </div>
            ) : null}
            {!payments?.bidders.length ? (
              <div className="mt-4">
                <EmptyState title="No bidder payments for this week." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-[var(--border-glass)] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Bidder</th>
                      <th className="py-2 pr-3 font-medium">Applications</th>
                      <th className="py-2 pr-3 font-medium">Application rate</th>
                      <th className="py-2 pr-3 font-medium">Application pay</th>
                      <th className="py-2 pr-3 font-medium">Interview schedules</th>
                      <th className="py-2 pr-3 font-medium">Interview rate</th>
                      <th className="py-2 pr-3 font-medium">Interview pay</th>
                      <th className="py-2 pr-3 font-medium">Total pay</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.bidders.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--border-glass)]">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{row.bidderName}</p>
                          <p className="text-[13px] text-[var(--text-secondary)]">{row.bidderEmail}</p>
                        </td>
                        <td className="py-2 pr-3">{row.applicationCount}</td>
                        <td className="py-2 pr-3">{formatUsd(row.applicationRate)}</td>
                        <td className="py-2 pr-3">{formatUsd(row.applicationPayAmount)}</td>
                        <td className="py-2 pr-3">{row.interviewCount}</td>
                        <td className="py-2 pr-3">{formatUsd(row.interviewRate)}</td>
                        <td className="py-2 pr-3">{formatUsd(row.interviewPayAmount)}</td>
                        <td className="py-2 pr-3 font-medium">{formatUsd(row.totalAmount)}</td>
                        <td className="py-2">
                          <StatusBadge tone={paymentStatusTone(row.status)}>
                            {paymentStatusLabel(row.status)}
                          </StatusBadge>
                          {row.status === 'DRAFT' ? (
                            <Button
                              variant="ghost"
                              className="ml-2 !px-2 !py-1 text-xs print:hidden"
                              disabled={Boolean(paymentActionId)}
                              onClick={() => void reviewBidder(row.id)}
                            >
                              Review
                            </Button>
                          ) : null}
                          {isAdmin && row.status === 'REVIEWED' ? (
                            <Button
                              variant="ghost"
                              className="ml-2 !px-2 !py-1 text-xs print:hidden"
                              disabled={Boolean(paymentActionId)}
                              onClick={() => void payBidder(row.id)}
                            >
                              Mark paid
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            className="mt-6"
            title="Bid Manager Salaries"
            description="Fixed weekly salary. Separate from bidder performance pay."
          >
            {!payments?.managers.length ? (
              <div className="mt-4">
                <EmptyState title="No manager salaries for this week." />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border-glass)] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Manager</th>
                      <th className="py-2 pr-4 font-medium">Weekly salary</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.managers.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--border-glass)]">
                        <td className="py-2 pr-4">{row.managerName}</td>
                        <td className="py-2 pr-4">{formatUsd(row.weeklySalaryRate)}</td>
                        <td className="py-2 pr-4 font-medium">{formatUsd(row.totalAmount)}</td>
                        <td className="py-2">
                          <StatusBadge tone={paymentStatusTone(row.status)}>
                            {paymentStatusLabel(row.status)}
                          </StatusBadge>
                          {isAdmin && row.status === 'DRAFT' ? (
                            <Button
                              variant="ghost"
                              className="ml-2 !px-2 !py-1 text-xs print:hidden"
                              disabled={Boolean(paymentActionId)}
                              onClick={() => void reviewManager(row.id)}
                            >
                              Review
                            </Button>
                          ) : null}
                          {isAdmin && row.status === 'REVIEWED' ? (
                            <Button
                              variant="ghost"
                              className="ml-2 !px-2 !py-1 text-xs print:hidden"
                              disabled={Boolean(paymentActionId)}
                              onClick={() => void payManager(row.id)}
                            >
                              Mark paid
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
            </>
          )}
        </>
      )}
    </section>
  )
}
