import type { ReactNode } from 'react'
import { Link } from '../routing'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--text-meta)] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>
      ) : null}
    </div>
  )
}

export function PageLink({
  to,
  children,
}: {
  to: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="text-sm font-medium text-[var(--accent)] transition hover:text-[var(--text-primary)] hover:underline hover:underline-offset-4"
    >
      {children}
    </Link>
  )
}
