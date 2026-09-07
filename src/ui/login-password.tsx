import { Button } from './chrome'
import { DEFAULT_MEMBER_PASSWORD } from './roles'

export function LoginPasswordPanel({
  personName,
  onApplyDefault,
  pending,
}: {
  personName: string
  onApplyDefault?: () => void
  pending?: boolean
}) {
  return (
    <div className="glass-control px-4 py-4">
      <p className="text-[11px] font-medium tracking-[0.14em] text-[var(--text-meta)] uppercase">
        Login password
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-[var(--text-primary)] select-all">
        {DEFAULT_MEMBER_PASSWORD}
      </p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Share this with {personName}. Stored passwords cannot be looked up. If they forgot
        theirs, reset the account to this password so this is what they use to sign in.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => void navigator.clipboard.writeText(DEFAULT_MEMBER_PASSWORD)}
        >
          Copy password
        </Button>
        {onApplyDefault ? (
          <Button disabled={pending} onClick={onApplyDefault}>
            {pending ? 'Saving…' : 'Reset to this password'}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
