import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0c0d0f] px-6">
      <p className="text-[11px] tracking-[0.18em] text-[#8f949e] uppercase">SE7EN</p>
      <h1 className="text-lg font-semibold text-[#f2f2f3]">Page not found</h1>
      <Link href="/" className="text-sm font-semibold text-[#d98b46]">
        Back to dashboard
      </Link>
    </main>
  )
}
