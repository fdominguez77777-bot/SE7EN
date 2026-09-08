import type { LucideIcon } from 'lucide-react'
import { Link } from '@/lib/navigation'
import { ChevronRight } from 'lucide-react'

export type WorkflowStage = {
  to: string
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  tone: 'accent' | 'info' | 'neutral' | 'warning' | 'success'
}

const TONE = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  info: 'bg-white/[0.07] text-[var(--text-secondary)]',
  neutral: 'bg-white/[0.07] text-[var(--text-muted)]',
  warning: 'bg-[rgba(215,169,93,0.14)] text-[var(--semantic-warning)]',
  success: 'bg-[rgba(111,189,140,0.14)] text-[var(--semantic-success)]',
}

export function WorkflowMap({ stages }: { stages: WorkflowStage[] }) {
  return (
    <ol className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
      {stages.map((stage, index) => {
        const Icon = stage.icon
        return (
          <li
            key={`${stage.to}-${stage.label}`}
            className="flex min-w-0 flex-1 flex-col items-stretch lg:flex-row lg:items-center"
          >
            <Link
              to={stage.to}
              className="glass-card glass-clickable group relative min-w-0 flex-1 px-4 py-4 no-underline"
            >
              <span className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-10 items-center justify-center rounded-xl ${TONE[stage.tone]}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium tracking-[0.12em] text-[var(--text-secondary)] uppercase">
                    {stage.label}
                  </span>
                  <span className="num-metric mt-1 block truncate text-[1.7rem] leading-none tracking-tight">
                    {stage.value}
                  </span>
                  {stage.hint ? (
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {stage.hint}
                    </span>
                  ) : null}
                </span>
              </span>
            </Link>
            {index < stages.length - 1 ? (
              <ChevronRight
                className="mx-auto my-1 h-5 w-5 shrink-0 rotate-90 text-[var(--text-muted)] lg:mx-1.5 lg:my-0 lg:rotate-0"
                aria-hidden="true"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
