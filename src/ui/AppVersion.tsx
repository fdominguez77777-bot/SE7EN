const APP_VERSION = 'v7.27'

export function AppVersion({ className = '' }: { className?: string }) {
  return (
    <span className={`text-[11px] tracking-wide text-[var(--text-muted)] ${className}`}>
      {APP_VERSION}
    </span>
  )
}
