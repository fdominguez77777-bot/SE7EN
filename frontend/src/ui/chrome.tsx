import type { LucideIcon } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled,
  onClick,
  className = '',
  form,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  className?: string
  form?: string
}) {
  const styles = {
    primary:
      'border border-transparent bg-[var(--accent)] text-[#111214] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]',
    secondary:
      'border border-white/10 bg-[#1a1c21] text-[#d8d9dc] hover:bg-[#22252b]',
    ghost:
      'border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-white/[0.05] hover:text-[var(--text-primary)]',
    danger:
      'border border-[rgba(214,111,111,0.22)] bg-[rgba(214,111,111,0.08)] text-[#dd8080] hover:bg-[rgba(214,111,111,0.14)]',
  }
  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`glass-panel px-5 py-4 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function StatCard({
  value,
  label,
  hint,
  icon: Icon,
  tone = 'neutral',
}: {
  value: string | number
  label: string
  hint?: string
  icon?: LucideIcon
  tone?: 'accent' | 'info' | 'warning' | 'success' | 'neutral'
}) {
  const tones = {
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    info: 'bg-white/[0.06] text-[var(--text-secondary)]',
    warning: 'bg-[rgba(215,169,93,0.12)] text-[var(--semantic-warning)]',
    success: 'bg-[rgba(111,189,140,0.12)] text-[var(--semantic-success)]',
    neutral: 'bg-white/[0.06] text-[var(--text-muted)]',
  }
  return (
    <div className="glass-card surface-live px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-[var(--text-secondary)]">{label}</p>
          <p className="num-metric mt-2 text-[28px] leading-none tracking-tight">{value}</p>
          {hint ? (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span className={`rounded-lg p-2 ${tones[tone]}`}>
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'warning' | 'success' | 'info'
  children: ReactNode
}) {
  const styles = {
    danger: 'border-[rgba(214,111,111,0.22)] bg-[rgba(214,111,111,0.09)] text-[#dc8585]',
    warning: 'border-[rgba(215,169,93,0.22)] bg-[rgba(215,169,93,0.09)] text-[#ddb46e]',
    success: 'border-[rgba(111,189,140,0.22)] bg-[rgba(111,189,140,0.09)] text-[#83c99c]',
    info: 'border-white/10 bg-white/[0.04] text-[var(--text-secondary)]',
  }
  return (
    <p className={`rounded-lg border px-4 py-3 text-sm ${styles[tone]}`} role="alert">
      {children}
    </p>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${className}`} />
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="glass-toolbar flex flex-wrap gap-1 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition duration-150 ${
            value === item.id
              ? 'bg-white/[0.065] font-semibold text-[#f4f4f4] shadow-[inset_0_-2px_0_var(--accent)]'
              : 'text-[var(--text-muted)] hover:bg-white/[0.045] hover:text-[var(--text-primary)]'
          }`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
