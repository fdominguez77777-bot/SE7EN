import { useEffect, useId, useState } from 'react'

const CHICAGO_TZ = 'America/Chicago'

type ClockState = {
  hour: number
  minute: number
  second: number
  day: string
  label: string
}

function readChicagoClock(now = new Date()): ClockState {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
    day: '2-digit',
    weekday: 'long',
    month: 'short',
  }).formatToParts(now)

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    hour: Number(pick('hour')) || 0,
    minute: Number(pick('minute')) || 0,
    second: Number(pick('second')) || 0,
    day: pick('day'),
    label: `${pick('weekday')} · ${pick('month')} ${Number(pick('day'))}`,
  }
}

export function CentralClock() {
  const uid = useId().replace(/:/g, '')
  const [clock, setClock] = useState(() => readChicagoClock())

  useEffect(() => {
    const tick = () => setClock(readChicagoClock())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  const secondAngle = clock.second * 6
  const minuteAngle = clock.minute * 6 + clock.second * 0.1
  const hourAngle = (clock.hour % 12) * 30 + clock.minute * 0.5
  const spoken = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())

  const caseGrad = `${uid}-case`
  const dialGrad = `${uid}-dial`

  return (
    <div className="dash-watch" aria-live="polite" aria-atomic="true">
      <div
        className="dash-watch-case"
        role="img"
        aria-label={`Central Time, ${spoken}`}
      >
        <svg className="dash-watch-svg" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            <radialGradient id={caseGrad} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#e8ecf2" />
              <stop offset="40%" stopColor="#9aa3b2" />
              <stop offset="78%" stopColor="#3f4654" />
              <stop offset="100%" stopColor="#171b22" />
            </radialGradient>
            <radialGradient id={dialGrad} cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#30343c" />
              <stop offset="60%" stopColor="#171a20" />
              <stop offset="100%" stopColor="#0a0c10" />
            </radialGradient>
          </defs>

          {/* Case */}
          <circle cx="100" cy="100" r="98" fill={`url(#${caseGrad})`} />
          <circle
            cx="100"
            cy="100"
            r="98"
            fill="none"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="2"
          />
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="#101318"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
          />

          {/* Dial */}
          <circle cx="100" cy="100" r="82" fill={`url(#${dialGrad})`} />

          {/* Minute ticks */}
          {Array.from({ length: 60 }, (_, index) => {
            const major = index % 5 === 0
            const angle = ((index * 6) - 90) * (Math.PI / 180)
            const outer = 78
            const inner = major ? 68 : 74
            return (
              <line
                key={`t-${index}`}
                x1={100 + Math.cos(angle) * inner}
                y1={100 + Math.sin(angle) * inner}
                x2={100 + Math.cos(angle) * outer}
                y2={100 + Math.sin(angle) * outer}
                stroke={major ? '#e2b36a' : 'rgba(220,224,232,0.4)'}
                strokeWidth={major ? 2.4 : 1.1}
                strokeLinecap="round"
              />
            )
          })}

          {/* Numerals */}
          {[12, 3, 6, 9].map((num) => {
            const angle = ((num * 30) - 90) * (Math.PI / 180)
            return (
              <text
                key={num}
                x={100 + Math.cos(angle) * 54}
                y={100 + Math.sin(angle) * 54}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#f2f3f5"
                fontSize="14"
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {num}
              </text>
            )
          })}

          <text
            x="100"
            y="64"
            textAnchor="middle"
            fill="#d9a45a"
            fontSize="7.5"
            fontWeight="800"
            letterSpacing="3"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            SE7EN
          </text>

          {/* Date window */}
          <rect
            x="120"
            y="93"
            width="24"
            height="14"
            rx="2.5"
            fill="#0a0c10"
            stroke="rgba(217,139,70,0.45)"
            strokeWidth="1"
          />
          <text
            x="132"
            y="100"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f0c98a"
            fontSize="9"
            fontWeight="800"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {clock.day}
          </text>

          {/* Hour hand — solid fill polygon so it always renders */}
          <g transform={`rotate(${hourAngle} 100 100)`}>
            <polygon
              points="97.2,102 100,52 102.8,102"
              fill="#e6c08a"
              stroke="#8a6230"
              strokeWidth="0.4"
            />
          </g>

          {/* Minute hand */}
          <g transform={`rotate(${minuteAngle} 100 100)`}>
            <polygon
              points="98,102 100,38 102,102"
              fill="#eef1f5"
              stroke="#7d8694"
              strokeWidth="0.4"
            />
          </g>

          {/* Second hand */}
          <g transform={`rotate(${secondAngle} 100 100)`}>
            <line
              x1="100"
              y1="122"
              x2="100"
              y2="32"
              stroke="#d98b46"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="100" cy="122" r="3" fill="#d98b46" />
          </g>

          {/* Pivot */}
          <circle cx="100" cy="100" r="5.5" fill="#f0c98a" />
          <circle cx="100" cy="100" r="2.4" fill="#1a120a" />

          {/* Glass highlight */}
          <path
            d="M42 55 C62 34, 96 30, 132 40"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="dash-watch-meta">
        <p className="dash-watch-meta-title">Central Time</p>
        <p className="dash-watch-meta-date">{clock.label}</p>
      </div>
    </div>
  )
}
