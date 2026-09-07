import { useMemo, useState } from 'react'

import { average, type DayPoint } from './metrics'

export function ActivityChart({
  series,
  mode,
  unit = 'applications',
}: {
  series: DayPoint[]
  mode: 'total' | 'average'
  unit?: 'applications' | 'interviews'
}) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const height = 280
  const left = 40
  const right = 16
  const top = 16
  const bottom = 36
  const plotW = width - left - right
  const plotH = height - top - bottom
  const values = series.map((point) => point.value)
  const mean = average(values)
  const max = Math.max(...values, mean, 1)
  const yMax = niceMax(max)

  const coords = useMemo(
    () =>
      series.map((point, index) => {
        const x =
          left +
          (series.length <= 1 ? plotW / 2 : (index / (series.length - 1)) * plotW)
        const y = top + plotH - (point.value / yMax) * plotH
        return { x, y, point }
      }),
    [series, plotW, plotH, yMax],
  )

  const line = smoothPath(coords, top, top + plotH)
  const first = coords[0]
  const last = coords[coords.length - 1]
  const baseline = top + plotH
  const area =
    first && last
      ? `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`
      : ''
  const meanY = top + plotH - (mean / yMax) * plotH
  const ticks = [0, 0.5, 1].map((ratio) => ({
    y: top + plotH - ratio * plotH,
    label: formatAxis(yMax * ratio),
  }))
  const labelEvery = Math.max(1, Math.ceil(series.length / 8))
  const active = hover != null ? coords[hover] : null

  return (
    <div className="relative">
      {series.length === 0 ? (
        <p className="py-16 text-center text-sm text-[var(--text-secondary)]">
          No {unit} in this period.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[280px] w-full"
          role="img"
          aria-label={`${unit} over time`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={left}
                x2={left + plotW}
                y1={tick.y}
                y2={tick.y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 5"
              />
              <text
                x={left - 8}
                y={tick.y + 4}
                textAnchor="end"
                fill="var(--text-muted)"
                fontSize="11"
              >
                {tick.label}
              </text>
            </g>
          ))}
          <defs>
            <clipPath id="activity-plot">
              <rect x={left} y={top} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          <g clipPath="url(#activity-plot)">
          <path d={area} fill="rgba(217, 139, 70, 0.16)" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {mode === 'average' ? (
            <line
              x1={left}
              x2={left + plotW}
              y1={meanY}
              y2={meanY}
              stroke="var(--text-secondary)"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          ) : null}
          </g>
          {coords.map((row, index) => (
            <rect
              key={row.point.key}
              x={row.x - plotW / Math.max(series.length, 1) / 2}
              y={top}
              width={Math.max(plotW / Math.max(series.length, 1), 8)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}
          {series.map((point, index) =>
            index % labelEvery === 0 || index === series.length - 1 ? (
              <text
                key={point.key}
                x={coords[index].x}
                y={height - 10}
                textAnchor="middle"
                fill="var(--text-muted)"
                fontSize="11"
              >
                {point.label}
              </text>
            ) : null,
          )}
          {active ? (
            <g>
              <line
                x1={active.x}
                x2={active.x}
                y1={top}
                y2={top + plotH}
                stroke="rgba(255,255,255,0.12)"
              />
              <circle
                cx={active.x}
                cy={active.y}
                r="4"
                fill="var(--accent)"
              />
            </g>
          ) : null}
        </svg>
      )}
      {active ? (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-2 text-xs shadow-[var(--shadow-glass)]"
          style={{
            left: `min(${(active.x / width) * 100}%, calc(100% - 9rem))`,
          }}
        >
          <p className="text-[var(--text-muted)]">{active.point.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
            {active.point.value.toLocaleString()} {unit}
          </p>
          {mode === 'average' ? (
            <p className="mt-0.5 text-[var(--text-secondary)]">
              Period avg {mean.toFixed(1)} / day
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function smoothPath(
  coords: Array<{ x: number; y: number }>,
  minY: number,
  maxY: number,
) {
  if (coords.length === 0) {
    return ''
  }
  if (coords.length === 1) {
    return `M ${coords[0].x} ${coords[0].y}`
  }
  if (coords.length === 2) {
    return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`
  }
  const clampY = (value: number) => Math.min(maxY, Math.max(minY, value))
  let path = `M ${coords[0].x} ${coords[0].y}`
  for (let index = 0; index < coords.length - 1; index += 1) {
    const current = coords[index]
    const next = coords[index + 1]
    if (current.y >= maxY - 0.01 && next.y >= maxY - 0.01) {
      path += ` L ${next.x} ${next.y}`
      continue
    }
    const previous = coords[index - 1] ?? current
    const after = coords[index + 2] ?? next
    const control1x = current.x + (next.x - previous.x) / 6
    const control1y = clampY(current.y + (next.y - previous.y) / 6)
    const control2x = next.x - (after.x - current.x) / 6
    const control2y = clampY(next.y - (after.y - current.y) / 6)
    path += ` C ${control1x} ${control1y}, ${control2x} ${control2y}, ${next.x} ${next.y}`
  }
  return path
}

function niceMax(value: number) {
  if (value <= 4) {
    return 4
  }
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / exp
  const nice = norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * exp
}

function formatAxis(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`
  }
  return String(Math.round(value))
}
