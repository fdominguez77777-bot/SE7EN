import { BrandLogo } from '../BrandLogo'
import { Button } from '../chrome'

export function AppLoadingScreen({
  message = 'Preparing your workspace…',
  error = false,
  onRetry,
}: {
  message?: string
  error?: boolean
  onRetry?: () => void
}) {
  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6 text-[var(--text-primary)]">
      <div
        className="page-enter relative z-10 flex w-full max-w-sm flex-col items-center text-center"
        role="status"
        aria-live="polite"
        aria-busy={!error}
      >
        <span className="sr-only">
          {error ? 'Unable to load SE7EN' : 'Loading SE7EN'}
        </span>
        <BrandLogo size="xl" />
        <p className="mt-5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          SE7EN
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Job Operations</p>
        {error ? (
          <>
            <p className="app-status mt-8 text-sm font-medium text-[var(--text-primary)]">
              Unable to load your workspace
            </p>
            <p className="mt-2 max-w-xs text-sm text-[var(--text-muted)]">
              The server could not be reached. Check your connection and try
              again.
            </p>
            {onRetry ? (
              <Button className="mt-6" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <p className="app-status mt-8 text-sm text-[var(--text-muted)]">{message}</p>
            <div
              className="app-progress mt-5 h-[3px] w-[220px] max-w-full overflow-hidden rounded-full bg-white/10"
              aria-hidden="true"
            >
              <span className="app-progress-bar block h-full w-1/3 rounded-full bg-[var(--accent)]" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-spinner h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current/30 border-t-current ${className}`}
      aria-hidden="true"
    />
  )
}
