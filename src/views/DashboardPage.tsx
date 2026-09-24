import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { DashboardSummary, DashboardTeamBidder } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, SectionCard } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { PeriodSelector, usePeriodFilter } from '../ui/PeriodSelector'
import { rangeQuery, resolveRange } from '../ui/reporting-period'
import { ActivityChart } from './dashboard/ActivityChart'
import { CentralClock } from './dashboard/CentralClock'
import {
  assignDenseRanks,
  formatRate,
  formatSignedPercent,
  interviewRate,
  percentChange,
} from './dashboard/metrics'
import { Sparkline } from './dashboard/Sparkline'
import { TeamRanking } from './dashboard/TeamRanking'

type RankMetric = 'applications' | 'interviews'
type RankPeriod = 'day' | 'week' | 'custom'
type ChartMode = 'total' | 'average'

const DASHBOARD_REFRESH_MS = 12_000

function metricForPeriod(
  bidder: DashboardTeamBidder,
  period: RankPeriod,
  metric: RankMetric,
) {
  if (period === 'day') {
    return metric === 'applications'
      ? (bidder.todayApplications ?? 0)
      : (bidder.todayInterviews ?? 0)
  }
  if (period === 'week') {
    return metric === 'applications'
      ? (bidder.weekApplications ?? 0)
      : (bidder.weekInterviews ?? 0)
  }
  return metric === 'applications' ? bidder.applications : bidder.interviews
}

export function DashboardPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'ADMIN' || user?.role === 'BID_MANAGER'
  const period = usePeriodFilter('today')
  const range = period.range
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [rankMetric, setRankMetric] = useState<RankMetric>('applications')
  const [rankPeriod, setRankPeriod] = useState<RankPeriod>(
    period.preset === 'weekdays' ? 'week' : 'day',
  )
  const [chartMode, setChartMode] = useState<ChartMode>('total')

  useEffect(() => {
    if (period.applied.preset === 'today') {
      setRankPeriod('day')
    } else if (period.applied.preset === 'weekdays') {
      setRankPeriod('week')
    } else {
      setRankPeriod('custom')
    }
  }, [period.applied])

  const load = useCallback(async () => {
    const { data } = await api.get<DashboardSummary>('/dashboard', {
      params: rangeQuery(range),
    })
    setSummary(data)
  }, [period.applied])

  useEffect(() => {
    let cancelled = false
    let inFlight = false

    async function refresh(showLoading: boolean) {
      if (inFlight) {
        return
      }
      if (typeof document !== 'undefined' && document.hidden && !showLoading) {
        return
      }
      inFlight = true
      if (showLoading) {
        setLoading(true)
      }
      setError('')
      try {
        await load()
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err))
        }
      } finally {
        inFlight = false
        if (!cancelled && showLoading) {
          setLoading(false)
        }
      }
    }

    void refresh(true)
    const timer = window.setInterval(() => {
      void refresh(false)
    }, DASHBOARD_REFRESH_MS)
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void refresh(false)
      }
    }
    function onFocus() {
      void refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const periodApps = summary?.applications ?? 0
  const periodInts = summary?.interviews ?? 0
  const prevApps = summary?.previousApplications ?? 0
  const prevInts = summary?.previousInterviews ?? 0
  const todayApps = summary?.todayApplications ?? 0
  const todayInts = summary?.todayInterviews ?? 0
  const weekApps = summary?.weekApplications ?? 0
  const weekInts = summary?.weekInterviews ?? 0
  const activeBidderCount = summary?.activeBidderCount ?? 0
  const bidderCount = summary?.bidderCount ?? 0
  const appChange = percentChange(periodApps, prevApps)
  const intChange = percentChange(periodInts, prevInts)
  const weekdays = resolveRange('weekdays', '', '')
  const chartSeries = useMemo(
    () =>
      (summary?.weekDaily ?? []).map((point) => ({
        date: new Date(`${point.date}T00:00:00`),
        key: point.date,
        label: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        value:
          rankMetric === 'interviews' ? point.interviews ?? 0 : point.applications,
      })),
    [summary, rankMetric],
  )
  const weekPoints = summary?.weekDaily ?? []
  const intSpark = weekPoints.map((point) => point.interviews ?? 0)
  const sparkDates = weekPoints.map((point) => point.date)

  const performance = useMemo(() => {
    const pool = (summary?.bidders ?? []).filter((bidder) => {
      const role = bidder.role ?? 'BIDDER'
      if (role === 'BIDDER' || role === 'BID_MANAGER') {
        return true
      }
      return user?.id != null && bidder.id === user.id
    })
    const rows = pool.map((bidder) => {
      const value = metricForPeriod(bidder, rankPeriod, rankMetric)
      return { bidder, value }
    })
    const ranks = assignDenseRanks(rows.map((row) => row.value))
    return rows
      .map((row, index) => ({ ...row, rank: ranks[index] ?? 0 }))
      .sort(
        (a, b) =>
          (a.rank || 999) - (b.rank || 999) ||
          b.value - a.value ||
          a.bidder.name.localeCompare(b.bidder.name),
      )
  }, [summary, rankMetric, rankPeriod, user?.id])

  const rankingHasActivity = performance.some((row) => row.value > 0)
  const weekRate = interviewRate(weekInts, weekApps)
  const appsPerBidder =
    activeBidderCount > 0 ? weekApps / activeBidderCount : null
  const filterPreset = period.applied.preset
  const appsKpi =
    filterPreset === 'today'
      ? todayApps
      : filterPreset === 'weekdays'
        ? weekApps
        : periodApps
  const intsKpi =
    filterPreset === 'today'
      ? todayInts
      : filterPreset === 'weekdays'
        ? weekInts
        : periodInts
  const appsKpiChange =
    filterPreset === 'today' || filterPreset === 'weekdays' ? null : appChange
  const intsKpiChange =
    filterPreset === 'today' || filterPreset === 'weekdays' ? null : intChange
  const rankingTotal = (
    rankMetric === 'interviews'
      ? rankPeriod === 'day'
        ? todayInts
        : rankPeriod === 'week'
          ? weekInts
          : periodInts
      : rankPeriod === 'day'
        ? todayApps
        : rankPeriod === 'week'
          ? weekApps
          : periodApps
  ).toLocaleString()
  const rankingScope =
    rankPeriod === 'day'
      ? 'Today'
      : rankPeriod === 'week'
        ? 'This week'
        : range.label

  function selectAppsRanking() {
    setRankMetric('applications')
    if (filterPreset === 'today') {
      setRankPeriod('day')
    } else if (filterPreset === 'weekdays') {
      setRankPeriod('week')
    } else {
      setRankPeriod('custom')
    }
  }

  function selectIntsRanking() {
    setRankMetric('interviews')
    if (filterPreset === 'today') {
      setRankPeriod('day')
    } else if (filterPreset === 'weekdays') {
      setRankPeriod('week')
    } else {
      setRankPeriod('custom')
    }
  }

  return (
    <section className="dash-page">
      <header className="dash-hero">
        <div className="dash-hero-copy">
          <p className="dash-hero-kicker">Operations</p>
          <h1 className="dash-hero-title">Dashboard</h1>
          <p className="dash-hero-subtitle">
            Team application & interview performance · {range.label}
          </p>
        </div>
        <CentralClock />
      </header>

      <PeriodSelector
        preset={period.preset}
        fromDate={period.fromDate}
        toDate={period.toDate}
        onPreset={period.onPreset}
        onFromDate={period.setFromDate}
        onToDate={period.setToDate}
        onFilter={period.applyFilter}
        onRefresh={() => {
          setLoading(true)
          load()
            .catch((err) => setError(getApiErrorMessage(err)))
            .finally(() => setLoading(false))
        }}
        label={range.label}
      />

      {error ? <Alert>{error}</Alert> : null}

      {loading ? (
        <PageSkeleton metrics={3} rows={6} />
      ) : (
        <>
          <div className="dash-kpi-row">
            <KpiCard
              label="Active bidders"
              value={activeBidderCount}
              hint={`${bidderCount} on the team`}
            />
            <KpiCard
              label="Applications"
              value={appsKpi}
              change={appsKpiChange}
              hint={
                appsKpiChange != null
                  ? 'vs previous period'
                  : filterPreset === 'today'
                    ? 'Today'
                    : filterPreset === 'weekdays'
                      ? 'This week'
                      : range.label
              }
              selected={rankMetric === 'applications'}
              onSelect={selectAppsRanking}
            />
            <KpiCard
              label="Interviews"
              value={intsKpi}
              change={intsKpiChange}
              hint={
                intsKpiChange != null
                  ? 'vs previous period'
                  : filterPreset === 'today'
                    ? 'Today'
                    : filterPreset === 'weekdays'
                      ? 'This week'
                      : range.label
              }
              sparkline={intSpark}
              sparkDates={sparkDates}
              selected={rankMetric === 'interviews'}
              onSelect={selectIntsRanking}
            />
          </div>

          <div className="dash-main-grid">
            <SectionCard
              className="dash-panel dash-panel--chart"
              title={
                rankMetric === 'interviews'
                  ? 'Interview activity'
                  : 'Application activity'
              }
              description={weekdays.label}
              action={
                <Segmented
                  value={chartMode}
                  onChange={setChartMode}
                  options={[
                    { id: 'total', label: 'Total' },
                    { id: 'average', label: 'Average' },
                  ]}
                />
              }
            >
              <ActivityChart
                series={chartSeries}
                mode={chartMode}
                unit={rankMetric === 'interviews' ? 'interviews' : 'applications'}
              />
            </SectionCard>

            <SectionCard
              className="dash-panel dash-panel--snapshot"
              title="Snapshot"
              description="Quick period totals"
            >
              <div className="dash-snapshot">
                <SnapshotBlock
                  title="Today"
                  active={rankPeriod === 'day'}
                  onSelect={() => setRankPeriod('day')}
                >
                  <SummaryRow
                    label="Applications"
                    value={todayApps}
                    active={rankPeriod === 'day' && rankMetric === 'applications'}
                    onClick={() => {
                      setRankPeriod('day')
                      setRankMetric('applications')
                    }}
                  />
                  <SummaryRow
                    label="Interviews"
                    value={todayInts}
                    active={rankPeriod === 'day' && rankMetric === 'interviews'}
                    onClick={() => {
                      setRankPeriod('day')
                      setRankMetric('interviews')
                    }}
                  />
                </SnapshotBlock>

                <SnapshotBlock
                  title="This week"
                  active={rankPeriod === 'week'}
                  onSelect={() => setRankPeriod('week')}
                >
                  <SummaryRow
                    label="Applications"
                    value={weekApps}
                    active={rankPeriod === 'week' && rankMetric === 'applications'}
                    onClick={() => {
                      setRankPeriod('week')
                      setRankMetric('applications')
                    }}
                  />
                  <SummaryRow
                    label="Interviews"
                    value={weekInts}
                    active={rankPeriod === 'week' && rankMetric === 'interviews'}
                    onClick={() => {
                      setRankPeriod('week')
                      setRankMetric('interviews')
                    }}
                  />
                  <SummaryRow
                    label="Apps / bidder"
                    value={
                      appsPerBidder == null ? '—' : appsPerBidder.toFixed(1)
                    }
                  />
                  <SummaryRow label="Interview rate" value={formatRate(weekRate)} />
                </SnapshotBlock>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            className="dash-panel"
            title="Team ranking"
            description={`${
              rankMetric === 'interviews' ? 'Interviews' : 'Applications'
            } · ${rankingScope} · ${rankingTotal} total`}
            action={
              <div className="dash-rank-tools">
                <Segmented
                  value={rankPeriod}
                  onChange={setRankPeriod}
                  options={[
                    { id: 'day', label: 'Day' },
                    { id: 'week', label: 'Week' },
                    { id: 'custom', label: 'Custom' },
                  ]}
                />
                <Segmented
                  value={rankMetric}
                  onChange={setRankMetric}
                  options={[
                    { id: 'applications', label: 'Applications' },
                    { id: 'interviews', label: 'Interviews' },
                  ]}
                />
              </div>
            }
          >
            {performance.length === 0 ? (
              <EmptyState title="No teammates to rank." />
            ) : !rankingHasActivity ? (
              <EmptyState
                title="No activity in this period"
                description={`Try Week or a custom range — there are no ${
                  rankMetric === 'interviews' ? 'interviews' : 'applications'
                } to rank for ${
                  rankPeriod === 'day'
                    ? 'today'
                    : rankPeriod === 'week'
                      ? 'this week'
                      : 'this range'
                } yet.`}
              />
            ) : (
              <TeamRanking
                rows={performance}
                metricLabel={
                  rankMetric === 'interviews' ? 'Interviews' : 'Applications'
                }
                currentUserId={user?.id}
                isStaff={isStaff}
              />
            )}
          </SectionCard>
        </>
      )}
    </section>
  )
}

function SnapshotBlock({
  title,
  active,
  onSelect,
  children,
}: {
  title: string
  active?: boolean
  onSelect?: () => void
  children: ReactNode
}) {
  return (
    <div className={`dash-snapshot-block${active ? ' is-active' : ''}`}>
      <button type="button" className="dash-snapshot-heading" onClick={onSelect}>
        {title}
      </button>
      <div className="dash-snapshot-rows">{children}</div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  change,
  sparkline,
  sparkDates,
  selected,
  onSelect,
}: {
  label: string
  value: number
  hint?: string
  change?: number | null
  sparkline?: number[]
  sparkDates?: string[]
  selected?: boolean
  onSelect?: () => void
}) {
  const changeLabel = formatSignedPercent(change ?? null)
  const changeTone =
    change == null || change === 0
      ? 'text-[var(--text-muted)]'
      : change > 0
        ? 'text-[var(--semantic-success)]'
        : 'text-[var(--semantic-danger)]'
  const className = `dash-kpi${selected ? ' is-selected' : ''}${
    onSelect ? ' is-interactive' : ''
  }`
  const body = (
    <>
      <div className="dash-kpi-top">
        <p className="dash-kpi-label">{label}</p>
        {sparkline && sparkline.length > 0 ? (
          <div className="dash-kpi-spark">
            <Sparkline values={sparkline} dates={sparkDates} />
          </div>
        ) : null}
      </div>
      <p className="dash-kpi-value">{value.toLocaleString()}</p>
      {changeLabel ? (
        <p className={`dash-kpi-hint ${changeTone}`}>
          <span className="dash-kpi-change">{changeLabel}</span>
          {hint ? <span>{hint}</span> : null}
        </p>
      ) : hint ? (
        <p className="dash-kpi-hint">{hint}</p>
      ) : (
        <p className="dash-kpi-hint dash-kpi-hint--spacer">&nbsp;</p>
      )}
    </>
  )
  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        onClick={onSelect}
        aria-pressed={selected}
      >
        {body}
      </button>
    )
  }
  return <article className={className}>{body}</article>
}

function SummaryRow({
  label,
  value,
  active,
  onClick,
}: {
  label: string
  value: string | number
  active?: boolean
  onClick?: () => void
}) {
  const className = `dash-summary-row${active ? ' is-active' : ''}${
    onClick ? ' is-interactive' : ''
  }`
  const content = (
    <>
      <span className="dash-summary-label">{label}</span>
      <span className="dash-summary-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="dash-segmented">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`dash-segmented-btn${value === option.id ? ' is-active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
