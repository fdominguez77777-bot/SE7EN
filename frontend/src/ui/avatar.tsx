import { useEffect, useState } from 'react'

import { resolveMediaUrl } from '../api/client'

export function initials(name: string | null | undefined) {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const TONES = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  info: 'bg-white/[0.08] text-[var(--text-secondary)]',
  warning: 'bg-[rgba(215,169,93,0.14)] text-[var(--semantic-warning)]',
  success: 'bg-[rgba(111,189,140,0.14)] text-[var(--semantic-success)]',
  neutral: 'bg-white/[0.08] text-[var(--text-muted)]',
} as const

const SIZES = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
} as const

export function EntityAvatar({
  name,
  src,
  tone = 'neutral',
  size = 'md',
}: {
  name: string | null | undefined
  src?: string | null
  tone?: keyof typeof TONES
  size?: keyof typeof SIZES
}) {
  const [failed, setFailed] = useState(false)
  const imageSrc = resolveMediaUrl(src)
  useEffect(() => {
    setFailed(false)
  }, [imageSrc])
  const showPhoto = Boolean(imageSrc) && !failed
  const label = name?.trim() || 'Member'

  return (
    <span
      className={`entity-avatar inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${SIZES[size]} ${showPhoto ? '' : TONES[tone]}`}
      role="img"
      aria-label={label}
    >
      {showPhoto ? (
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover object-center"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  )
}
