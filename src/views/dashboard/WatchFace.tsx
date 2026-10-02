import type { ReactNode } from 'react'

const FONT = 'ui-sans-serif, system-ui, sans-serif'

function polar(angle: number, radius: number) {
  const rad = (angle - 90) * (Math.PI / 180)
  return { x: 100 + Math.cos(rad) * radius, y: 100 + Math.sin(rad) * radius }
}

export function WatchHands({ hour, minute, second }: { hour: number; minute: number; second?: number }) {
  const hourAngle = (hour % 12) * 30 + minute * 0.5
  const minuteAngle = minute * 6 + (second ?? 0) * 0.1
  return (
    <>
      <g transform={`rotate(${hourAngle} 100 100)`}>
        <polygon points="97.2,102 100,52 102.8,102" fill="#e6c08a" stroke="#8a6230" strokeWidth="0.4" />
      </g>
      <g transform={`rotate(${minuteAngle} 100 100)`}>
        <polygon points="98,102 100,38 102,102" fill="#eef1f5" stroke="#7d8694" strokeWidth="0.4" />
      </g>
      {second != null ? (
        <g transform={`rotate(${second * 6} 100 100)`}>
          <line x1="100" y1="122" x2="100" y2="32" stroke="#d98b46" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="100" cy="122" r="3" fill="#d98b46" />
        </g>
      ) : null}
    </>
  )
}

export function WatchFace({
  uid,
  brand = 'SE7EN',
  windowText,
  allNumerals = false,
  bare = false,
  children,
}: {
  uid: string
  brand?: string
  windowText?: string
  allNumerals?: boolean
  /** Case and dial only, for drawing a custom face on top. */
  bare?: boolean
  children: ReactNode
}) {
  const caseGrad = `${uid}-case`
  const dialGrad = `${uid}-dial`
  const numerals = allNumerals ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [12, 3, 6, 9]
  return (
    <svg className="dash-watch-svg" viewBox="0 0 200 200" aria-hidden={bare ? undefined : true}>
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

      <circle cx="100" cy="100" r="98" fill={`url(#${caseGrad})`} />
      <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
      <circle cx="100" cy="100" r="88" fill="#101318" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="82" fill={`url(#${dialGrad})`} />

      {bare ? null : (
      <>
      {Array.from({ length: 60 }, (_, index) => {
        const major = index % 5 === 0
        const inner = polar(index * 6, major ? 68 : 74)
        const outer = polar(index * 6, 78)
        return (
          <line
            key={`t-${index}`}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={major ? '#e2b36a' : 'rgba(220,224,232,0.4)'}
            strokeWidth={major ? 2.4 : 1.1}
            strokeLinecap="round"
          />
        )
      })}

      {numerals.map((num) => {
        const point = polar(num * 30, allNumerals ? 57 : 54)
        return (
          <text
            key={num}
            x={point.x}
            y={point.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f2f3f5"
            fontSize={allNumerals ? 11 : 14}
            fontWeight="700"
            fontFamily={FONT}
          >
            {num}
          </text>
        )
      })}

      <text
        x="100"
        y={allNumerals ? 72 : 64}
        textAnchor="middle"
        fill="#d9a45a"
        fontSize="7.5"
        fontWeight="800"
        letterSpacing="3"
        fontFamily={FONT}
      >
        {brand}
      </text>

      {windowText ? (
        <>
          <rect x="114" y="90" width="31" height="20" rx="3" fill="#0a0c10" stroke="rgba(217,139,70,0.55)" strokeWidth="1.2" />
          <text
            x="129.5"
            y="100.5"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f0c98a"
            fontSize="13"
            fontWeight="800"
            fontFamily={FONT}
          >
            {windowText}
          </text>
        </>
      ) : null}
      </>
      )}

      {children}

      <circle cx="100" cy="100" r="5.5" fill="#f0c98a" pointerEvents="none" />
      <circle cx="100" cy="100" r="2.4" fill="#1a120a" pointerEvents="none" />

      <path
        pointerEvents="none"
        d="M42 55 C62 34, 96 30, 132 40"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}
