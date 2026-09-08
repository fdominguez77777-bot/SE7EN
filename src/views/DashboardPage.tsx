import { useEffect, useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'

import { api, getApiErrorMessage } from '../api/client'
import type { DashboardSummary, DashboardTeamBidder } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Alert, SectionCard } from '../ui/chrome'
import { EmptyState } from '../ui/EmptyState'
import { PageSkeleton } from '../ui/loading/page-skeletons'
import { PeriodSelector, usePeriodFilter } from '../ui/PeriodSelector'
import { rangeQuery, resolveRange } from '../ui/reporting-period'
import { ActivityChart } from './dashboard/ActivityChart'
import {
  assignDenseRanks,
  formatRate,
  formatSignedPercent,
  interviewRate,
  percentChange,
} from './dashboard/metrics'
import { Sparkline } from './dashboard/Sparkline'

type RankMetric = 'applications' | 'interviews'
type RankPeriod = 'day' | 'week' | 'custom'
type ChartMode = 'total' | 'average'

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

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(delta / 60000)
  if (minutes < 1) {
    return 'Just now'
  }
  if (minutes < 60) {
    return `${minutes} min ago`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} hr ago`
  }
  const days = Math.round(hours / 24)
  if (days < 7) {
    return `${days}d ago`
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
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
  const [rankPeriod, setRankPeriod] = useState<RankPeriod>('day')
  const [chartMode, setChartMode] = useState<ChartMode>('total')

  async function load() {
    const { data } = await api.get<DashboardSummary>('/dashboard', {
      params: rangeQuery(range),
    })
    setSummary(data)
  }

  useEffect(() => {
    setLoading(true)
    setError('')
    load()
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [period.applied])

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
    const rows = (summary?.bidders ?? []).map((bidder) => {
      const value = metricForPeriod(bidder, rankPeriod, rankMetric)
      return { bidder, value }
    })
    const ranks = assignDenseRanks(rows.map((row) => row.value))
    return rows
      .map((row, index) => ({ ...row, rank: ranks[index] }))
      .sort((a, b) => a.rank - b.rank || a.bidder.name.localeCompare(b.bidder.name))
  }, [summary, rankMetric, rankPeriod])

  const barMax = Math.max(...performance.map((row) => row.value), 0)
  const weekRate = interviewRate(weekInts, weekApps)
  const appsPerBidder =
    activeBidderCount > 0 ? weekApps / activeBidderCount : null
  const recent = summary?.recent ?? []

  return (
    <section>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Team application & interview performance
          </p>
        </div>
      </header>
      <div className="mt-4">
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
      </div>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <PageSkeleton metrics={3} rows={6} />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <KpiCard
              label="Active bidders"
              value={activeBidderCount}
              hint={`${bidderCount} bidder${bidderCount === 1 ? '' : 's'} on the team`}
            />
            <KpiCard
              label="Applications"
              value={periodApps}
              change={appChange}
              hint="vs previous equivalent period"
              selected={rankMetric === 'applications' && rankPeriod === 'custom'}
              onSelect={() => {
                setRankMetric('applications')
                setRankPeriod('custom')
              }}
            />
            <KpiCard
              label="Interviews"
              value={periodInts}
              change={intChange}
              hint="vs previous equivalent period"
              sparkline={intSpark}
              sparkDates={sparkDates}
              selected={rankMetric === 'interviews' && rankPeriod === 'custom'}
              onSelect={() => {
                setRankMetric('interviews')
                setRankPeriod('custom')
              }}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-10">
            <SectionCard
              className="lg:col-span-7"
              title={
                rankMetric === 'interviews'
                  ? 'Interview Activity'
                  : 'Application Activity'
              }
              description={weekdays.label}
              action={
                <div className="flex rounded-lg border border-[var(--border-default)] p-0.5">
                  {(['total', 'average'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition duration-150 ${
                        chartMode === mode
                          ? 'bg-white/[0.08] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                      onClick={() => setChartMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              }
            >
              <ActivityChart
                series={chartSeries}
                mode={chartMode}
                unit={rankMetric === 'interviews' ? 'interviews' : 'applications'}
              />
            </SectionCard>

            <SectionCard className="lg:col-span-3" title="Today / This week">
              <div
                className={`rounded-lg px-2 py-2 ${
                  rankPeriod === 'day'
                    ? 'bg-white/[0.06] shadow-[inset_2px_0_0_var(--accent)]'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setRankPeriod('day')}
                >
                  <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--text-muted)] uppercase">
                    Today
                  </p>
                </button>
                <dl className="mt-2 space-y-1">
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
                </dl>
              </div>
              <div className="my-3 border-t border-[var(--border-subtle)]" />
              <div
                className={`rounded-lg px-2 py-2 ${
                  rankPeriod === 'week'
                    ? 'bg-white/[0.06] shadow-[inset_2px_0_0_var(--accent)]'
                    : ''
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setRankPeriod('week')}
                >
                  <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--text-muted)] uppercase">
                    This week
                  </p>
                </button>
                <dl className="mt-2 space-y-1">
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
                    label="Applications per bidder"
                    value={
                      appsPerBidder == null ? '—' : appsPerBidder.toFixed(1)
                    }
                  />
                  <SummaryRow label="Interview rate" value={formatRate(weekRate)} />
                </dl>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            className="mt-6"
            title="Bidder ranking"
            description={`${rankMetric === 'interviews' ? 'Interviews' : 'Applications'} · ${
              rankPeriod === 'day'
                ? 'Today'
                : rankPeriod === 'week'
                  ? 'This week'
                  : range.label
            }`}
            action={
              <div className="flex flex-wrap justify-end gap-2">
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
              <EmptyState title="No bidders to rank." />
            ) : (
              <div>
                <div className="mb-2 hidden grid-cols-[3rem_minmax(0,1fr)_6.5rem] gap-4 px-1 text-[11px] font-medium tracking-[0.12em] text-[var(--text-muted)] uppercase md:grid">
                  <span>Rank</span>
                  <span>Bidder</span>
                  <span className="text-right">
                    {rankMetric === 'interviews' ? 'Interviews' : 'Applications'}
                  </span>
                </div>
                <ul className="divide-y divide-white/[0.06]">
                  {performance.map((row) => (
                    <li
                      key={row.bidder.id}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_6.5rem] items-center gap-4 py-3"
                    >
                      <p className="num-metric text-sm text-[var(--text-muted)]">
                        #{row.rank}
                      </p>
                      <div className="min-w-0">
                        {isStaff ? (
                          <Link
                            to={`/bidders?bidderId=${row.bidder.id}`}
                            className="block truncate font-semibold text-[var(--text-primary)] no-underline hover:text-[var(--accent)]"
                          >
                            {row.bidder.name}
                          </Link>
                        ) : (
                          <p className="truncate font-semibold text-[var(--text-primary)]">
                            {row.bidder.name}
                          </p>
                        )}
                        <p className="truncate text-[13px] text-[var(--text-secondary)]">
                          {row.bidder.email}
                          {row.bidder.isActive === false ? ' · Disabled' : ''}
                        </p>
                      </div>
                      <p className="num-metric text-right text-base">
                        {row.value.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-5">
            <SectionCard
              className="lg:col-span-3"
              title={
                rankMetric === 'interviews'
                  ? 'Interviews by Bidder'
                  : 'Applications by Bidder'
              }
              description={
                rankPeriod === 'day'
                  ? 'Today'
                  : rankPeriod === 'week'
                    ? 'This week'
                    : range.label
              }
            >
              {performance.length === 0 ? (
                <EmptyState title="No bidders to compare." />
              ) : (
                <ul className="space-y-3">
                  {performance.map((row) => (
                    <li key={row.bidder.id} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-sm font-medium text-[var(--text-primary)] md:w-36">
                        {row.bidder.name}
                      </span>
                      <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className="block h-full rounded-full bg-[var(--accent)]/80 transition-[width] duration-150"
                          style={{
                            width: `${barMax <= 0 ? 0 : Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / barMax) * 100))}%`,
                          }}
                        />
                      </span>
                      <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                        {row.value.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard className="lg:col-span-2" title="Recent Activity">
              {recent.length === 0 ? (
                <EmptyState title="No recent application or interview activity." />
              ) : (
                <ul className="space-y-3">
                  {recent.map((item) => (
                    <li key={item.id}>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--text-secondary)]">
                        {item.detail}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        {relativeTime(item.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </section>
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
  const className = `glass-card w-full px-5 py-4 text-left ${
    selected ? 'ring-1 ring-[var(--accent)]/45' : ''
  } ${onSelect ? 'cursor-pointer transition duration-150 hover:bg-white/[0.03]' : ''}`
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-[var(--text-secondary)]">{label}</p>
        {sparkline && sparkline.length > 0 ? (
          <div className="text-right">
            <Sparkline values={sparkline} dates={sparkDates} />
            <p className="mt-0.5 text-[10px] font-medium tracking-wide text-[var(--text-muted)]">
              This week
            </p>
          </div>
        ) : null}
      </div>
      <p className="num-metric mt-3 text-[2rem] leading-none tracking-tight">
        {value.toLocaleString()}
      </p>
      {changeLabel ? (
        <p className={`mt-2 text-[13px] font-medium ${changeTone}`}>
          {changeLabel}
          <span className="ml-1 font-normal text-[var(--text-muted)]">
            {hint}
          </span>
        </p>
      ) : hint ? (
        <p className="mt-2 text-[13px] text-[var(--text-muted)]">{hint}</p>
      ) : null}
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
  const className = `flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-1 text-left ${
    active ? 'bg-white/[0.05]' : ''
  } ${onClick ? 'cursor-pointer hover:bg-white/[0.05]' : ''}`
  const content = (
    <>
      <dt
        className={`text-sm ${
          active ? 'font-medium text-[var(--accent)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        {label}
      </dt>
      <dd
        className={`num-metric text-base ${
          active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </dd>
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
    <div className="flex rounded-lg border border-[var(--border-default)] p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition duration-150 ${
            value === option.id
              ? 'bg-white/[0.08] text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
