import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

import { hintFor, jumpTargets, makeDial } from './hands-of-time'
import { WatchFace } from './WatchFace'

const LEVEL_KEY = 'se7en-hands-of-time-level'
const RING = 64
const FONT = 'ui-sans-serif, system-ui, sans-serif'

function polar(angle: number, radius: number) {
  const rad = (angle - 90) * (Math.PI / 180)
  return { x: 100 + Math.cos(rad) * radius, y: 100 + Math.sin(rad) * radius }
}

function readLevel() {
  try {
    return Math.max(1, Number(window.localStorage.getItem(LEVEL_KEY)) || 1)
  } catch {
    return 1
  }
}

function saveLevel(level: number) {
  try {
    window.localStorage.setItem(LEVEL_KEY, String(level))
  } catch {
    // Storage can be blocked; progress just resets next time.
  }
}

function pressable(action: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        action()
      }
    },
  }
}

function IconButton({
  x,
  y,
  label,
  disabled = false,
  attention = false,
  radius = 8,
  onPress,
  children,
}: {
  x: number
  y: number
  label: string
  disabled?: boolean
  attention?: boolean
  radius?: number
  onPress: () => void
  children: ReactNode
}) {
  const icon = radius * 1.25
  return (
    <g
      className={`hot-ctl${disabled ? ' is-off' : ''}${attention ? ' is-attention' : ''}`}
      aria-label={label}
      aria-disabled={disabled || undefined}
      {...pressable(() => {
        if (!disabled) onPress()
      })}
    >
      <title>{label}</title>
      <circle cx={x} cy={y} r={radius} />
      <g transform={`translate(${x - icon / 2} ${y - icon / 2}) scale(${icon / 24})`}>{children}</g>
    </g>
  )
}

export function ClockPuzzle({ uid, onExit }: { uid: string; onExit: () => void }) {
  const [level, setLevel] = useState(readLevel)
  const [values, setValues] = useState(() => makeDial(readLevel()))
  const [path, setPath] = useState<number[]>([])
  const [hint, setHint] = useState<number | null>(null)
  const [nudgeUndo, setNudgeUndo] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef(onExit)

  useEffect(() => {
    exitRef.current = onExit
  }, [onExit])

  useEffect(() => {
    rootRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') exitRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const size = values.length
  const used = new Set(path)
  const current = path.length ? path[path.length - 1] : null
  const targets = current == null ? [] : jumpTargets(current, values)
  const open = targets.filter((target) => !used.has(target))
  const solved = path.length === size
  const stuck = current != null && !solved && open.length === 0
  const stone = size <= 8 ? 12 : 10.5

  function tapStone(index: number) {
    if (solved) return
    if (current == null) {
      setPath([index])
    } else if (open.includes(index)) {
      setPath([...path, index])
    } else {
      return
    }
    setHint(null)
    setNudgeUndo(false)
  }

  function undo() {
    if (!path.length || solved) return
    setPath(path.slice(0, -1))
    setHint(null)
    setNudgeUndo(false)
  }

  function restart() {
    setPath([])
    setHint(null)
    setNudgeUndo(false)
  }

  function showHint() {
    if (solved) return
    const next = hintFor(path, values)
    if (next == null) {
      setHint(null)
      setNudgeUndo(true)
    } else {
      setHint(next)
      setNudgeUndo(false)
    }
  }

  function goToLevel(target: number) {
    saveLevel(target)
    setLevel(target)
    setValues(makeDial(target))
    setPath([])
    setHint(null)
    setNudgeUndo(false)
  }

  function nextLevel() {
    goToLevel(level + 1)
  }

  function backToLevelOne() {
    goToLevel(1)
  }

  const status = solved
    ? 'Solved!'
    : stuck
      ? 'Stuck · undo'
      : nudgeUndo
        ? 'Dead end · undo'
        : current == null
          ? 'Pick a start'
          : `${size - path.length} left`
  const statusTone = solved ? '#f5c542' : stuck || nudgeUndo ? '#e58a8a' : '#b2b6bf'

  return (
    <div
      ref={rootRef}
      className={`dash-watch-case is-playing${solved ? ' is-solved' : ''}`}
      tabIndex={-1}
      role="group"
      aria-label={`Hands of Time, level ${level}. ${status}.`}
    >
      <WatchFace uid={`${uid}-hot`} bare>
        <circle cx="100" cy="100" r={RING} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" pointerEvents="none" />

        {current != null && !solved
          ? targets.map((target, order) => {
              const end = polar((target * 360) / size, RING - stone - 2)
              const taken = used.has(target)
              return (
                <line
                  key={`hand-${target}`}
                  x1="100"
                  y1="100"
                  x2={end.x}
                  y2={end.y}
                  stroke={order === 0 ? '#e6c08a' : '#eef1f5'}
                  strokeOpacity={taken ? 0.18 : 0.75}
                  strokeWidth={order === 0 ? 2.6 : 1.8}
                  strokeDasharray={taken ? '3 3' : undefined}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )
            })
          : null}

        {values.map((value, index) => {
          const point = polar((index * 360) / size, RING)
          const isUsed = used.has(index)
          const isCurrent = index === current
          const isTarget = !solved && open.includes(index)
          const isHint = index === hint
          const pickable = !solved && (current == null || isTarget)
          const order = path.indexOf(index)
          const classes = [
            'hot-stone',
            isUsed ? 'is-used' : '',
            isCurrent ? 'is-current' : '',
            isTarget ? 'is-target' : '',
            isHint ? 'is-hint' : '',
            pickable ? 'is-pickable' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <g
              key={index}
              className={classes}
              style={solved ? ({ '--hot-delay': `${order * 70}ms` } as CSSProperties) : undefined}
              aria-label={`Stone ${value}${isUsed ? ', cleared' : ''}${isTarget ? ', reachable' : ''}`}
              aria-disabled={!pickable || undefined}
              {...pressable(() => tapStone(index))}
            >
              <circle cx={point.x} cy={point.y} r={stone} />
              <text
                x={point.x}
                y={point.y + 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={stone > 11 ? 11 : 10}
                fontWeight="800"
                fontFamily={FONT}
              >
                {value}
              </text>
            </g>
          )
        })}

        <text
          x="100"
          y="80"
          textAnchor="middle"
          fill="#d9a45a"
          fontSize="7"
          fontWeight="800"
          letterSpacing="2.5"
          fontFamily={FONT}
          pointerEvents="none"
        >
          {`LEVEL ${level}`}
        </text>
        <text
          x="100"
          y="119"
          textAnchor="middle"
          dominantBaseline="central"
          fill={statusTone}
          fontSize="8"
          fontWeight="700"
          fontFamily={FONT}
          pointerEvents="none"
        >
          {status}
        </text>

        <IconButton x={100} y={60} label="Back to clock" onPress={() => exitRef.current()}>
          <path d="M6 6l12 12M18 6L6 18" />
        </IconButton>

        {solved ? (
          <g className="hot-next" aria-label="Next level" {...pressable(nextLevel)}>
            <title>Next level</title>
            <rect x="80" y="129" width="40" height="15" rx="7.5" />
            <text x="100" y="136.8" textAnchor="middle" dominantBaseline="central" fontSize="7.5" fontWeight="800" fontFamily={FONT}>
              NEXT ›
            </text>
          </g>
        ) : (
          <>
            <IconButton
              x={74.5}
              y={134}
              radius={7.5}
              label="Undo"
              disabled={!path.length}
              attention={stuck || nudgeUndo}
              onPress={undo}
            >
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10a6 6 0 010 12h-3" />
            </IconButton>
            <IconButton x={91.5} y={134} radius={7.5} label="Hint" onPress={showHint}>
              <path d="M9 18h6M10 22h4" />
              <path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
            </IconButton>
            <IconButton x={108.5} y={134} radius={7.5} label="Restart level" disabled={!path.length} onPress={restart}>
              <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </IconButton>
            <IconButton x={125.5} y={134} radius={7.5} label="Back to level 1" disabled={level === 1} onPress={backToLevelOne}>
              <path d="M19 20L9 12l10-8v16z" />
              <path d="M5 19V5" />
            </IconButton>
          </>
        )}
      </WatchFace>
    </div>
  )
}
