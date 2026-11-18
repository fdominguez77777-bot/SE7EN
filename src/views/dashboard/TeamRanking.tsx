import type { CSSProperties } from 'react'
import { Link } from '@/lib/navigation'

import type { DashboardTeamBidder } from '../../api/types'
import { formatPlace } from './metrics'

export type RankingRow = {
  bidder: DashboardTeamBidder
  value: number
  rank: number
}

function Runner({ lead }: { lead: boolean }) {
  return (
    <svg viewBox="0 0 46 36" className="race-figure" aria-hidden="true">
      {lead ? (
        <g className="race-streak">
          <path d="M1.2 12.5 H7.4" />
          <path d="M0.4 16.4 H8" />
          <path d="M2 20.2 H7.2" />
        </g>
      ) : null}
      <ellipse className="race-shadow" cx="24" cy="33.4" rx="12" ry="1.15" />
      <circle cx="32" cy="6.8" r="3.05" />
      <path d="M30.1 9.7 L22.6 18.2" />
      <path d="M27.2 12.2 L18.4 16.4 L14.6 13.4" />
      <path d="M27.2 12.2 L35.4 15.6 L40.4 12.2" />
      <path d="M22.6 18.2 L14.4 26.6 L9.2 30.2" />
      <path d="M22.6 18.2 L30.6 27.2 L38.8 31.6" />
    </svg>
  )
}

function FinishFlag() {
  const cells = []
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      cells.push(
        <rect
          key={`${col}-${row}`}
          x={3.1 + col * 2.7}
          y={1.15 + row * 2.7}
          width={2.7}
          height={2.7}
          fill={(col + row) % 2 === 0 ? '#f6f6f7' : '#15171b'}
        />
      )
    }
  }
  return (
    <svg viewBox="0 0 16 23" className="race-flag" aria-hidden="true">
      <path d="M2.4 1.1 V22" />
      <circle cx="2.4" cy="1.15" r="1" />
      {cells}
    </svg>
  )
}

function Lane({
  row,
  ratio,
  isStaff,
  isYou,
  isLeader,
}: {
  row: RankingRow
  ratio: number
  isStaff: boolean
  isYou: boolean
  isLeader: boolean
}) {
  const name = isStaff ? (
    <Link to={`/bidders?bidderId=${row.bidder.id}`} className="race-name">
      {row.bidder.name}
    </Link>
  ) : (
    <span className="race-name">{row.bidder.name}</span>
  )
  const at = `${Math.round(ratio * 1000) / 10}%`

  return (
    <li
      className={`race-lane${isLeader ? ' is-leader' : ''}${isYou ? ' is-you' : ''}`}
    >
      <div className="race-meta">
        {name}
        <span className="race-value">{row.value.toLocaleString()}</span>
      </div>
      <div className="race-track">
        <span className="race-runner" style={{ left: at } as CSSProperties}>
          <Runner lead={isLeader} />
        </span>
      </div>
      <FinishFlag />
    </li>
  )
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
  const runners = ranked.filter((row) => row.value > 0)
  const leader = ranked.find((row) => row.rank === 1) ?? null
  const you = currentUserId
    ? ranked.find((row) => row.bidder.id === currentUserId)
    : undefined
  const metric = metricLabel.toLowerCase()
  const yourGap =
    you && leader ? Math.max(0, leader.value - you.value) : null
  const max = Math.max(...runners.map((row) => row.value), 1)
  const finish = metric === 'applications' ? 100 : max

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

      {runners.length > 0 ? (
        <div className="race-board">
          {finish === 100 ? <div className="race-goal">100</div> : null}
          <ol className="race" aria-label={`${metricLabel} ranking`}>
            {runners.map((row) => (
              <Lane
                key={row.bidder.id}
                row={row}
                ratio={Math.min(row.value / finish, 1)}
                isStaff={isStaff}
                isYou={row.bidder.id === currentUserId}
                isLeader={row.rank === 1}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
