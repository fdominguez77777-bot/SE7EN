'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="bg-[#0c0d0f] text-[#f2f2f3]">
        <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <button
            type="button"
            className="text-sm font-semibold text-[#d98b46]"
            onClick={reset}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
