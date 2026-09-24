import { Link } from '@/lib/navigation'
import { Trophy } from 'lucide-react'

import type { DashboardTeamBidder } from '../../api/types'
import { EntityAvatar } from '../../ui/avatar'
import { formatPlace } from './metrics'

export type RankingRow = {
  bidder: DashboardTeamBidder
  value: number
  rank: number
}

export function TeamRanking({
  rows,
  metricLabel,
  currentUserId,
  isStaff,
}: {
  rows: RankingRow[]
  metricLabel: string
  currentUserId?: number
  isStaff: boolean
}) {
  const ranked = rows
    .filter((row) => row.rank > 0)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.value - a.value ||
        a.bidder.name.localeCompare(b.bidder.name),
    )
  const columns = pyramidColumns(ranked)
  const leader = ranked.find((row) => row.rank === 1) ?? null
  const second = ranked.find((row) => row.rank === 2) ?? null
  const leadBy =
    leader && second ? Math.max(0, leader.value - second.value) : 0
  const you = currentUserId
    ? ranked.find((row) => row.bidder.id === currentUserId)
    : undefined
  const max = Math.max(...ranked.map((row) => row.value), 1)
  const metric = metricLabel.toLowerCase()
  const yourGap =
    you && leader ? Math.max(0, leader.value - you.value) : null

  return (
    <div className="podium">
      {you && you.rank > 0 ? (
        <div className="podium-status" role="status">
          <p>
            You are <strong>{formatPlace(you.rank)}</strong>
            {yourGap != null && leader ? (
              yourGap === 0 ? (
                <> · leading the board</>
              ) : (
                <>
                  {' '}
                  · {yourGap.toLocaleString()} {metric} from 1st (
                  <strong>{leader.bidder.name}</strong>)
                </>
              )
            ) : null}
          </p>
        </div>
      ) : null}

      <div
        className="podium-chart"
        role="img"
        aria-label={`${metricLabel} ranking`}
      >
        <ul className="podium-bars">
          {columns.map((row, index) => {
            const isYou = row.bidder.id === currentUserId
            const isLeader = row.rank === 1
            // Keep short bars readable without distorting the leader peak.
            const height = Math.max(18, Math.round((row.value / max) * 100))
            const compact = height < 36
            const tone =
              row.rank === 1
                ? '1'
                : row.rank === 2
                  ? '2'
                  : row.rank === 3
                    ? '3'
                    : 'n'
            const nameNode = isStaff ? (
              <Link
                to={`/bidders?bidderId=${row.bidder.id}`}
                className="podium-name"
              >
                {row.bidder.name}
              </Link>
            ) : (
              <span className="podium-name">{row.bidder.name}</span>
            )

            return (
              <li
                key={row.bidder.id}
                className={`podium-col podium-col--${tone}${isYou ? ' is-you' : ''}${isLeader ? ' is-leader' : ''}`}
                style={{ ['--podium-i' as string]: String(index) }}
              >
                <div className="podium-head">
                  <div className="podium-trophy-slot">
                    {isLeader ? (
                      <Trophy className="podium-trophy" aria-hidden="true" />
                    ) : null}
                  </div>
                  <EntityAvatar
                    name={row.bidder.name}
                    size={isLeader ? 'md' : 'sm'}
                    tone={
                      isLeader
                        ? 'accent'
                        : row.rank === 2
                          ? 'info'
                          : row.rank === 3
                            ? 'warning'
                            : 'neutral'
                    }
                  />
                  <div className="podium-identity">
                    {nameNode}
                    {isYou ? <span className="podium-pill is-you">You</span> : null}
                    {row.bidder.role === 'BID_MANAGER' && !isYou ? (
                      <span className="podium-pill">Manager</span>
                    ) : null}
                    {row.bidder.role === 'ADMIN' && !isYou ? (
                      <span className="podium-pill">Admin</span>
                    ) : null}
                  </div>
                  <span className="podium-place">{formatPlace(row.rank)}</span>
                </div>

                <div className="podium-track">
                  <div
                    className={`podium-bar${compact ? ' is-compact' : ''}`}
                    style={{ height: `${height}%` }}
                    title={`${row.bidder.name}: ${row.value.toLocaleString()} ${metric}`}
                  >
                    <span className="podium-value">
                      {row.value.toLocaleString()}
                    </span>
                    {isLeader && leadBy > 0 ? (
                      <span className="podium-lead">+{leadBy.toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** Mountain order: lower ranks flank outward, 1st centered. */
export function pyramidColumns(rows: RankingRow[]): RankingRow[] {
  const first = rows
    .filter((row) => row.rank === 1)
    .sort((a, b) => a.bidder.name.localeCompare(b.bidder.name))
  const others = rows
    .filter((row) => row.rank !== 1)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.value - a.value ||
        a.bidder.name.localeCompare(b.bidder.name),
    )
  const left: RankingRow[] = []
  const right: RankingRow[] = []
  others.forEach((row, index) => {
    if (index % 2 === 0) {
      left.push(row)
    } else {
      right.push(row)
    }
  })
  left.reverse()
  return [...left, ...first, ...right]
}
