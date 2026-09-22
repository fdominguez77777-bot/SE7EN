import { Link } from '@/lib/navigation'
import { Trophy } from 'lucide-react'

import type { DashboardTeamBidder } from '../../api/types'
import { EntityAvatar } from '../../ui/avatar'
import { formatPlace, placeParts } from './metrics'

export type RankingRow = {
  bidder: DashboardTeamBidder
  value: number
  rank: number
}

const PLOT_PX = 220
const MIN_BAR_PX = 8

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
  const ranked = rows.filter((row) => row.rank > 0)
  const leader = ranked.find((row) => row.rank === 1)
  const runnerUp = ranked.find((row) => row.rank > 1)
  const leadBy =
    leader && runnerUp ? Math.max(0, leader.value - runnerUp.value) : 0
  const you = currentUserId
    ? rows.find((row) => row.bidder.id === currentUserId)
    : undefined
  const max = Math.max(...ranked.map((row) => row.value), 1)
  const columns = pyramidColumns(ranked)

  return (
    <div>
      {you && leader ? (
        <p className="rank-chase" role="status">
          {you.rank === 1 ? (
            leadBy > 0 ? (
              <>
                You hold <strong>{formatPlace(1)}</strong>. Lead is {leadBy.toLocaleString()}{' '}
                {metricLabel.toLowerCase()} — keep it.
              </>
            ) : (
              <>
                You hold <strong>{formatPlace(1)}</strong> on this board.
              </>
            )
          ) : (
            <>
              You are <strong>{formatPlace(you.rank)}</strong>
              {you.value < leader.value ? (
                <>
                  {' '}
                  · {(leader.value - you.value).toLocaleString()}{' '}
                  {metricLabel.toLowerCase()} from {formatPlace(1)}
                  {leader.bidder.name ? ` (${leader.bidder.name})` : ''}
                </>
              ) : null}
            </>
          )}
        </p>
      ) : null}

      <figure className="rank-diagram">
        <figcaption className="sr-only">
          {metricLabel} ranking chart with first place in the center
        </figcaption>
        <div className="rank-chart">
          {columns.map((row) => {
            const featured = row.rank === 1 && row.value > 0
            const isYou = row.bidder.id === currentUserId
            const height = Math.max(
              row.value > 0 ? MIN_BAR_PX : 4,
              Math.round((row.value / max) * PLOT_PX),
            )
            const tone =
              row.rank === 1 ? '1' : row.rank === 2 ? '2' : row.rank === 3 ? '3' : 'n'
            const place = placeParts(row.rank)
            const name = (
              <span className="rank-col-name">
                {row.bidder.name}
                {isYou ? <span className="rank-you">You</span> : null}
              </span>
            )
            return (
              <div
                key={row.bidder.id}
                className={`rank-col rank-col--${tone}${isYou ? ' rank-col--you' : ''}`}
              >
                <div className="rank-col-head">
                  {featured ? (
                    <span className="rank-trophy" aria-hidden="true">
                      <Trophy className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                  ) : null}
                  <EntityAvatar
                    name={row.bidder.name}
                    size={featured ? 'xl' : 'md'}
                    tone={featured ? 'accent' : row.rank <= 3 ? 'info' : 'neutral'}
                  />
                  {isStaff ? (
                    <Link
                      to={`/bidders?bidderId=${row.bidder.id}`}
                      className="rank-col-link"
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                  <p className="rank-col-place" aria-label={place.label}>
                    <span className="rank-col-place-num">{place.rank}</span>
                    <span className="rank-col-place-ord">{place.suffix}</span>
                  </p>
                </div>
                <div className="rank-col-plot">
                  <div className="rank-col-bar" style={{ height }}>
                    <span className="rank-col-value">{row.value.toLocaleString()}</span>
                    {featured && leadBy > 0 ? (
                      <span className="rank-col-lead">+{leadBy.toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </figure>
    </div>
  )
}

/** 6th → 4th → 2nd → 1st → 3rd → 5th → 6th so first place is the peak. */
export function pyramidColumns(rows: RankingRow[]): RankingRow[] {
  const first = rows
    .filter((row) => row.rank === 1)
    .sort((a, b) => a.bidder.name.localeCompare(b.bidder.name))
  const others = rows
    .filter((row) => row.rank !== 1)
    .sort(
      (a, b) =>
        a.rank - b.rank || b.value - a.value || a.bidder.name.localeCompare(b.bidder.name),
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
