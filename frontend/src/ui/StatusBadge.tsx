export function StatusBadge({
  children,
  tone = 'neutral',
  muted = false,
}: {
  children: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'applied' | 'draft'
  muted?: boolean
}) {
  const styles = {
    neutral: 'border-white/10 bg-white/[0.04] text-[var(--text-secondary)]',
    info: 'border-white/10 bg-white/[0.05] text-[#a5abb5]',
    success: 'border-[rgba(111,189,140,0.18)] bg-[rgba(111,189,140,0.09)] text-[#83c99c]',
    warning: 'border-[rgba(215,169,93,0.18)] bg-[rgba(215,169,93,0.09)] text-[#ddb46e]',
    danger: 'border-[rgba(214,111,111,0.18)] bg-[rgba(214,111,111,0.09)] text-[#dc8585]',
    muted: 'border-white/10 bg-white/[0.03] text-[var(--text-muted)]',
    applied: 'border-[rgba(96,165,250,0.35)] bg-[rgba(59,130,246,0.16)] text-[#9cc6f8]',
    draft: 'border-[rgba(217,139,70,0.4)] bg-[rgba(217,139,70,0.16)] text-[#e8b57a]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${
        muted ? styles.muted : styles[tone]
      }`}
    >
      {children}
    </span>
  )
}

export function applicationStatusTone(status: string) {
  const normalized = status.trim().toUpperCase().replace(/\s+/g, '_')
  if (normalized === 'INTERVIEWING') {
    return 'info' as const
  }
  if (normalized === 'OFFER') {
    return 'success' as const
  }
  if (normalized === 'REJECTED') {
    return 'danger' as const
  }
  if (normalized === 'WITHDRAWN') {
    return 'muted' as const
  }
  if (normalized === 'APPLIED') {
    return 'applied' as const
  }
  if (normalized === 'DRAFT') {
    return 'draft' as const
  }
  return 'neutral' as const
}

export function interviewStatusTone(status: string) {
  if (status === 'SCHEDULED') {
    return 'warning' as const
  }
  if (status === 'COMPLETED') {
    return 'success' as const
  }
  if (status === 'CANCELLED') {
    return 'muted' as const
  }
  if (status === 'NO_SHOW') {
    return 'danger' as const
  }
  return 'neutral' as const
}

export function paymentStatusTone(status: string) {
  if (status === 'PAID') {
    return 'success' as const
  }
  if (status === 'REVIEWED') {
    return 'info' as const
  }
  return 'warning' as const
}
