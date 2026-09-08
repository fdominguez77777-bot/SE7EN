import { useEffect } from 'react'
import { useParams } from '@/lib/navigation'

export function CalendarConnectPage() {
  const { token = '' } = useParams()

  useEffect(() => {
    if (!token) {
      return
    }
    window.location.replace(`/api/calendar/oauth/start?token=${encodeURIComponent(token)}`)
  }, [token])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--app-bg)] px-6">
      <p className="text-sm text-[var(--text-secondary)]">Opening calendar authorization…</p>
    </main>
  )
}
