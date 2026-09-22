'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'

import { Button } from './chrome'
import { DEFAULT_MEMBER_PASSWORD } from './roles'

function maskPassword(value: string) {
  return '•'.repeat(Math.max(value.length, 1))
}

export function MemberPasswordText({
  password,
  label = 'password',
  size = 'sm',
  showCopy = true,
}: {
  password: string | null | undefined
  label?: string
  size?: 'sm' | 'lg'
  showCopy?: boolean
}) {
  const [visible, setVisible] = useState(false)

  if (!password) {
    return (
      <span className="text-xs text-[var(--text-muted)]">Unknown</span>
    )
  }

  return (
    <span
      className="inline-flex min-w-0 items-center gap-0.5"
      onClick={(event) => event.stopPropagation()}
    >
      <span
        className={
          size === 'lg'
            ? `font-mono text-2xl font-semibold tracking-[0.22em] text-[var(--text-primary)] ${
                visible ? 'select-all' : 'select-none'
              }`
            : `font-mono text-sm font-medium tracking-[0.18em] text-[var(--text-primary)] ${
                visible ? 'select-all' : 'select-none'
              }`
        }
      >
        {visible ? password : maskPassword(password)}
      </span>
      <button
        type="button"
        className="rounded-md p-1 text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
        aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        ) : (
          <Eye className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        )}
      </button>
      {showCopy ? (
        <button
          type="button"
          className="rounded-md p-1 text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
          aria-label={`Copy ${label}`}
          onClick={() => void navigator.clipboard.writeText(password)}
        >
          <Copy className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  )
}

export function LoginPasswordPanel({
  personName,
  password,
  onApplyDefault,
  pending,
}: {
  personName: string
  password?: string | null
  onApplyDefault?: () => void
  pending?: boolean
}) {
  const isResetHelper = password === undefined
  const shown = isResetHelper ? DEFAULT_MEMBER_PASSWORD : password
  return (
    <div className="glass-control px-4 py-4">
      <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--text-meta)] uppercase">
        Sign-in password
      </p>
      <div className="mt-1">
        {shown ? (
          <MemberPasswordText
            password={shown}
            label={`sign-in password for ${personName}`}
            size="lg"
            showCopy={false}
          />
        ) : (
          <p className="font-mono text-2xl font-semibold tracking-wider text-[var(--text-primary)]">
            —
          </p>
        )}
      </div>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {isResetHelper
          ? `If ${personName} forgot their password, reset the account to this one and share it with them.`
          : shown
            ? `Share this with ${personName} so they can sign in.`
            : `Not recorded yet. ${personName} must sign in once, or you can set a password below, before it can be shown here.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {shown ? (
          <Button
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(shown)}
          >
            Copy password
          </Button>
        ) : null}
        {onApplyDefault ? (
          <Button disabled={pending} onClick={onApplyDefault}>
            {pending ? 'Saving…' : 'Reset to default password'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
