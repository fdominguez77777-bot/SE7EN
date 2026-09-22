'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function FunLoader({
  compact = false,
  overlay = true,
  label = 'Loading',
}: {
  compact?: boolean
  overlay?: boolean
  label?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const text = label.replace(/…+$/, '')

  const stage = (
    <div
      className={`fun-loader-stage ${compact ? 'fun-loader-stage--compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="fun-loader-spinner" aria-hidden="true" />
      <p className="fun-loader-label">{text}…</p>
    </div>
  )

  if (!overlay) {
    return stage
  }

  return (
    <>
      <div className="fun-loader-slot" aria-hidden="true" />
      {mounted
        ? createPortal(
            <div className="fun-loader-overlay print:hidden">{stage}</div>,
            document.body,
          )
        : null}
    </>
  )
}
