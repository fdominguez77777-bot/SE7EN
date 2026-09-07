import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="empty-state">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white/[0.03] text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
