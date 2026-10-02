import { useState, type CSSProperties } from 'react'
import { RefreshCw } from 'lucide-react'

import { EAST, NORTH, SOUTH, WEST, isSolved, litTiles, makeBoard, masksFor, sideCount, type Board } from './connect-team'

type Difficulty = 'easy' | 'medium' | 'hard'

const SIZES: Record<Difficulty, { cols: number; rows: number; label: string }> = {
  easy: { cols: 5, rows: 4, label: 'Easy' },
  medium: { cols: 7, rows: 5, label: 'Medium' },
  hard: { cols: 9, rows: 6, label: 'Hard' },
}

const BEST_KEY = 'se7en-connect-team-best'

type BestMoves = Partial<Record<Difficulty, number>>

function readBest(): BestMoves {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? '{}') as BestMoves
  } catch {
    return {}
  }
}

function saveBest(best: BestMoves) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best))
  } catch {
    // Storage can be blocked; the best score just won't persist.
  }
}

function freshBoard(difficulty: Difficulty) {
  const { cols, rows } = SIZES[difficulty]
  return makeBoard(cols, rows)
}

function PipeTile({ mask, hub, lit }: { mask: number; hub: boolean; lit: boolean }) {
  const leaf = !hub && sideCount(mask) === 1
  const ends = [
    { side: NORTH, x: 20, y: 0 },
    { side: EAST, x: 40, y: 20 },
    { side: SOUTH, x: 20, y: 40 },
    { side: WEST, x: 0, y: 20 },
  ]
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      {ends
        .filter((end) => mask & end.side)
        .map((end) => (
          <line key={end.side} x1="20" y1="20" x2={end.x} y2={end.y} className="ct-pipe" />
        ))}
      <circle cx="20" cy="20" r="3.5" className="ct-joint" />
      {hub ? <circle cx="20" cy="20" r="9" className="ct-hub" /> : null}
      {leaf ? <circle cx="20" cy="20" r="6.5" className={`ct-node${lit ? ' is-lit' : ''}`} /> : null}
    </svg>
  )
}

export function ConnectTeam() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [board, setBoard] = useState<Board>(() => freshBoard('easy'))
  const [turns, setTurns] = useState<number[]>(() => [])
  const [moves, setMoves] = useState(0)
  const [best, setBest] = useState<BestMoves>(readBest)
  const [recorded, setRecorded] = useState(false)

  const masks = masksFor(board, turns)
  const lit = litTiles(board, masks)
  const solved = isSolved(board, masks)
  const bidders = masks.filter((mask, index) => index !== board.hub && sideCount(mask) === 1).length
  const linked = masks.filter((mask, index) => index !== board.hub && sideCount(mask) === 1 && lit.has(index)).length

  function start(next: Difficulty) {
    setDifficulty(next)
    setBoard(freshBoard(next))
    setTurns([])
    setMoves(0)
    setRecorded(false)
  }

  function rotate(index: number, direction: 1 | -1) {
    if (solved) return
    const nextTurns = board.base.map((_, cell) => (turns[cell] ?? 0) + (cell === index ? direction : 0))
    const nextMoves = moves + 1
    setTurns(nextTurns)
    setMoves(nextMoves)
    if (!recorded && isSolved(board, masksFor(board, nextTurns))) {
      setRecorded(true)
      const previous = best[difficulty]
      if (previous == null || nextMoves < previous) {
        const updated = { ...best, [difficulty]: nextMoves }
        setBest(updated)
        saveBest(updated)
      }
    }
  }

  const { cols } = SIZES[difficulty]
  const bestMoves = best[difficulty]

  return (
    <div className={`ct${solved ? ' is-solved' : ''}`}>
      <div className="ct-head">
        <div>
          <p className="ct-title">Connect the team</p>
          <p className="ct-sub">
            {solved
              ? `Everyone is connected in ${moves} moves.`
              : 'Nothing to rank yet. Rotate the tiles until every bidder links back to the hub.'}
          </p>
        </div>
        <div className="ct-tools">
          <div className="ct-levels" role="tablist" aria-label="Difficulty">
            {(Object.keys(SIZES) as Difficulty[]).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={difficulty === id}
                className={difficulty === id ? 'is-on' : ''}
                onClick={() => start(id)}
              >
                {SIZES[id].label}
              </button>
            ))}
          </div>
          <button type="button" className="ct-new" onClick={() => start(difficulty)} aria-label="New puzzle" title="New puzzle">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="ct-board">
        <div className="ct-grid" style={{ '--ct-cols': cols } as CSSProperties} role="grid" aria-label="Pipe tiles">
          {board.base.map((baseMask, index) => {
            const isHub = index === board.hub
            const isLit = lit.has(index)
            return (
              <button
                key={`${board.cols}-${index}`}
                type="button"
                role="gridcell"
                className={`ct-tile${isLit ? ' is-lit' : ''}${isHub ? ' is-hub' : ''}`}
                aria-label={`${isHub ? 'Hub' : 'Tile'} ${index + 1}${isLit ? ', connected' : ''}`}
                onClick={() => rotate(index, 1)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  rotate(index, -1)
                }}
                disabled={solved}
              >
                <span className="ct-spin" style={{ transform: `rotate(${(turns[index] ?? 0) * 90}deg)` }}>
                  <PipeTile mask={baseMask} hub={isHub} lit={isLit} />
                </span>
              </button>
            )
          })}
        </div>

        <div className="ct-stats">
          <div>
            <span>Bidders linked</span>
            <strong>
              {linked}/{bidders}
            </strong>
          </div>
          <div>
            <span>Moves</span>
            <strong>{moves}</strong>
          </div>
          <div>
            <span>Best</span>
            <strong>{bestMoves ?? '—'}</strong>
          </div>
          {solved ? (
            <button type="button" className="ct-again" onClick={() => start(difficulty)}>
              Play again
            </button>
          ) : (
            <p className="ct-help">Click to rotate · Right-click to turn back</p>
          )}
        </div>
      </div>
    </div>
  )
}
