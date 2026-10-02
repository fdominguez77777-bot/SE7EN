import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

import {
  BEST_KEY,
  judge,
  nextTarget,
  normalizeAngle,
  speedFor,
  sweptPast,
  widthFor,
  type Strike,
} from './split-second'
import { WatchFace } from './WatchFace'

const TRACK = 66
const HAND = 72
const FONT = 'ui-sans-serif, system-ui, sans-serif'

type Phase = 'ready' | 'running' | 'over'
type Target = { center: number; width: number }

function polar(angle: number, radius: number) {
  const rad = (angle - 90) * (Math.PI / 180)
  return { x: 100 + Math.cos(rad) * radius, y: 100 + Math.sin(rad) * radius }
}

function arcPath(center: number, width: number, radius: number) {
  const start = polar(center - width / 2, radius)
  const end = polar(center + width / 2, radius)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
}

function readBest() {
  try {
    return Math.max(0, Number(window.localStorage.getItem(BEST_KEY)) || 0)
  } catch {
    return 0
  }
}

function saveBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value))
  } catch {
    // Storage can be blocked; the best score just won't persist.
  }
}

export function ClockReflex({ uid, onExit }: { uid: string; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [best, setBest] = useState(readBest)
  const [newBest, setNewBest] = useState(false)
  const [target, setTarget] = useState<Target>({ center: 180, width: widthFor(0) })
  const [flash, setFlash] = useState<{ kind: Strike; key: number } | null>(null)
  const [missAngle, setMissAngle] = useState<number | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const handRef = useRef<SVGGElement>(null)
  const exitRef = useRef(onExit)
  const game = useRef({ angle: 0, dir: 1, remaining: 180, hits: 0, points: 0, width: widthFor(0) })

  useEffect(() => {
    exitRef.current = onExit
  }, [onExit])

  function drawHand() {
    handRef.current?.setAttribute('transform', `rotate(${game.current.angle} 100 100)`)
  }

  function start() {
    const first = 100 + Math.random() * 160
    game.current = { angle: 0, dir: 1, remaining: first, hits: 0, points: 0, width: widthFor(0) }
    setTarget({ center: first, width: widthFor(0) })
    setScore(0)
    setHits(0)
    setNewBest(false)
    setFlash(null)
    setMissAngle(null)
    drawHand()
    setPhase('running')
  }

  function end() {
    const state = game.current
    setMissAngle(normalizeAngle(state.angle))
    setPhase('over')
    setFlash({ kind: 'miss', key: Date.now() })
    if (state.points > readBest()) {
      saveBest(state.points)
      setBest(state.points)
      setNewBest(true)
    }
  }

  const endRef = useRef(end)
  useEffect(() => {
    endRef.current = end
  })

  function strike() {
    if (phase !== 'running') {
      start()
      return
    }
    const state = game.current
    const result = judge(state.remaining, state.width)
    if (result === 'miss') {
      end()
      return
    }
    state.hits += 1
    state.points += result === 'perfect' ? 2 : 1
    const next = nextTarget(state.hits)
    if (next.flip) state.dir = -state.dir
    state.width = widthFor(state.hits)
    state.remaining = next.ahead
    setTarget({ center: normalizeAngle(state.angle + state.dir * next.ahead), width: state.width })
    setScore(state.points)
    setHits(state.hits)
    setFlash({ kind: result, key: Date.now() })
  }

  const strikeRef = useRef(strike)
  useEffect(() => {
    strikeRef.current = strike
  })

  useEffect(() => {
    rootRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        exitRef.current()
      } else if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault()
        strikeRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (phase !== 'running') return
    let frame = 0
    let last = performance.now()
    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const state = game.current
      const travel = speedFor(state.hits) * dt
      state.angle = normalizeAngle(state.angle + state.dir * travel)
      state.remaining -= travel
      drawHand()
      if (sweptPast(state.remaining, state.width)) {
        endRef.current()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  function onPointerDown(event: ReactPointerEvent) {
    if (event.button !== 0) return
    if ((event.target as Element).closest('.ss-exit')) return
    strike()
  }

  const speedPct = Math.round((speedFor(hits) / speedFor(1000)) * 100)
  const missPoint = missAngle == null ? null : polar(missAngle, TRACK)

  return (
    <div
      ref={rootRef}
      className={`dash-watch-case is-playing ss-game is-${phase}`}
      tabIndex={-1}
      role="group"
      aria-label={`Split Second. ${phase === 'running' ? `Score ${score}` : phase === 'over' ? `Game over, score ${score}, best ${best}` : `Best ${best}. Press space or click to start`}.`}
      onPointerDown={onPointerDown}
    >
      <WatchFace uid={`${uid}-ss`} bare>
        {Array.from({ length: 60 }, (_, index) => {
          const major = index % 5 === 0
          const outer = polar(index * 6, 80)
          const inner = polar(index * 6, major ? 75 : 77.5)
          return (
            <line
              key={index}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={major ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={major ? 1.4 : 0.7}
              pointerEvents="none"
            />
          )
        })}

        <circle cx="100" cy="100" r={TRACK} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" pointerEvents="none" />

        {phase !== 'ready' ? (
          <g key={`${target.center}-${target.width}`} className="ss-target" pointerEvents="none">
            <path d={arcPath(target.center, target.width, TRACK)} className="ss-target-arc" strokeWidth="9" fill="none" />
            <path
              d={arcPath(target.center, target.width * 0.3, TRACK)}
              className="ss-target-core"
              strokeWidth="9"
              fill="none"
            />
          </g>
        ) : null}

        {flash && flash.kind !== 'miss' ? (
          <circle key={flash.key} cx="100" cy="100" r={TRACK} className={`ss-ring is-${flash.kind}`} fill="none" pointerEvents="none" />
        ) : null}

        {missPoint ? <circle cx={missPoint.x} cy={missPoint.y} r="5" className="ss-miss-dot" pointerEvents="none" /> : null}

        <text x="100" y="56" textAnchor="middle" className="ss-label" fontSize="6.5" fontWeight="800" letterSpacing="2.4" fontFamily={FONT} pointerEvents="none">
          SPLIT SECOND
        </text>

        {phase === 'ready' ? (
          <g pointerEvents="none" fontFamily={FONT} textAnchor="middle">
            <text x="100" y="86" className="ss-big" fontSize="13" fontWeight="800">
              TAP TO START
            </text>
            <text x="100" y="121" className="ss-sub" fontSize="7" fontWeight="600">
              Strike inside the gold arc
            </text>
            <text x="100" y="132" className="ss-sub is-dim" fontSize="6.5" fontWeight="600">
              {best > 0 ? `Best ${best} · Space or click` : 'Space or click'}
            </text>
          </g>
        ) : (
          <g pointerEvents="none" fontFamily={FONT} textAnchor="middle">
            <text x="100" y="88" className={`ss-score${phase === 'over' ? ' is-over' : ''}`} fontSize="28" fontWeight="800">
              {score}
            </text>
            {phase === 'running' ? (
              <>
                {flash?.kind === 'perfect' ? (
                  <text key={flash.key} x="100" y="122" className="ss-perfect" fontSize="7.5" fontWeight="800" letterSpacing="1.5">
                    PERFECT +2
                  </text>
                ) : (
                  <text x="100" y="122" className="ss-sub is-dim" fontSize="6.5" fontWeight="700" letterSpacing="1.2">
                    {`SPEED ${speedPct}%`}
                  </text>
                )}
                <text x="100" y="133" className="ss-sub is-dim" fontSize="6.5" fontWeight="600">
                  {`Best ${Math.max(best, score)}`}
                </text>
              </>
            ) : (
              <>
                <text x="100" y="121" className={newBest ? 'ss-perfect' : 'ss-miss'} fontSize="8" fontWeight="800" letterSpacing="1.5">
                  {newBest ? 'NEW BEST!' : 'MISSED'}
                </text>
                <text x="100" y="132" className="ss-sub is-dim" fontSize="6.5" fontWeight="600">
                  {`Best ${best} · tap to retry`}
                </text>
              </>
            )}
          </g>
        )}

        <g ref={handRef} transform="rotate(0 100 100)" pointerEvents="none" className="ss-hand">
          <line x1="100" y1="112" x2="100" y2={100 - HAND} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="100" cy={100 - TRACK} r="2.6" />
        </g>

        <g
          className="ss-exit"
          role="button"
          tabIndex={0}
          aria-label="Back to clock"
          onClick={() => exitRef.current()}
          onKeyDown={(event: ReactKeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              exitRef.current()
            }
          }}
        >
          <title>Back to clock</title>
          <circle cx="100" cy="154" r="7.5" />
          <path d="M96.5 150.5l7 7M103.5 150.5l-7 7" />
        </g>
      </WatchFace>
    </div>
  )
}
