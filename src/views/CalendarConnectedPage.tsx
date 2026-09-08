import { Link, useSearchParams } from '@/lib/navigation'

import { useAuth } from '../auth/AuthContext'

export function CalendarConnectedPage() {
  const { status } = useAuth()
  const [params] = useSearchParams()
  const failed = params.get('error') === '1'
  const token = params.get('token')?.trim() ?? ''

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--app-bg)] px-6">
      <div className="max-w-md text-center">
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
          {failed ? 'Calendar was not connected' : 'Calendar connected'}
        </h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          {failed
            ? 'The link may have expired, or calendar access was denied. Generate a new link from Calendar integrations.'
            : 'This Gmail is connected. Use the same link again to add another Gmail — pick a different Google account when Google asks.'}
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          {token && !failed ? (
            <Link
              to={`/calendar/connect/${token}`}
              className="text-[13px] font-semibold text-[var(--accent)]"
            >
              Add another Gmail
            </Link>
          ) : null}
          {status === 'authenticated' ? (
            <Link
              to="/interviews/integrations"
              className="text-[13px] font-semibold text-[var(--accent)]"
            >
              Back to integrations
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  )
}
