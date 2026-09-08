'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--app-bg)] px-6">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h1>
      <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={reset}>
        Try again
      </button>
    </main>
  )
}
