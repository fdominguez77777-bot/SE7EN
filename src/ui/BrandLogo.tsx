import { Link } from '@/lib/navigation'

import logoSrc from '../assets/brand/deseven-logo.png'

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-[42px] w-[42px]',
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
} as const

export function BrandLogo({
  size = 'md',
  className = '',
}: {
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span className={`brand-logo ${SIZES[size]} ${className}`}>
      <img
        src={typeof logoSrc === 'string' ? logoSrc : logoSrc.src}
        alt="SE7EN logo"
        width={320}
        height={320}
      />
    </span>
  )
}

export function BrandLockup({
  to = '/',
  onNavigate,
}: {
  to?: string
  onNavigate?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="brand-home flex min-w-0 items-center gap-3 rounded-lg"
      aria-label="SE7EN Dashboard"
    >
      <BrandLogo size="md" />
      <span className="min-w-0 text-left">
        <span className="block text-sm font-semibold tracking-tight text-[var(--text-primary)]">
          SE7EN
        </span>
        <span className="block text-[13px] text-[var(--text-muted)]">
          Job Operations
        </span>
      </span>
    </Link>
  )
}
