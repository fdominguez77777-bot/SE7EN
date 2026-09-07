const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function Sparkline({
  values,
  dates,
  className = '',
}: {
  values: number[]
  dates?: string[]
  className?: string
}) {
  const width = 132
  const height = 40
  const top = 4
  const bottom = 14
  const chartHeight = height - top - bottom
  if (values.length === 0) {
    return <div className={`h-10 w-[132px] ${className}`} />
  }
  const max = Math.max(...values, 1)
  const gap = 3
  const barWidth = Math.max(6, (width - gap * (values.length + 1)) / values.length)

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {values.map((value, index) => {
        const x = gap + index * (barWidth + gap)
        const barHeight = Math.max(2, (value / max) * chartHeight)
        const y = top + chartHeight - barHeight
        const date = dates?.[index]
        const label = date
          ? WEEKDAY[new Date(`${date}T12:00:00`).getDay()]
          : String(index + 1)
        return (
          <g key={`${label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="1.5"
              fill={value > 0 ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'}
              opacity={value > 0 ? 0.9 : 1}
            />
            <text
              x={x + barWidth / 2}
              y={height - 2}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize="8"
              fontWeight="600"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
