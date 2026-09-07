import { useState } from 'react'

import { Button } from './chrome'

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting…',
  pending = false,
  confirmTone = 'danger',
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel?: string
  pendingLabel?: string
  pending?: boolean
  confirmTone?: 'danger' | 'primary'
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className={`dialog-root fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden ${
        pending ? 'dialog-pending' : ''
      }`}
    >
      <button
        type="button"
        className="dialog-overlay absolute inset-0 bg-[var(--overlay-bg)]"
        aria-label="Cancel"
        disabled={pending}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="dialog-panel glass-raised relative z-10 w-full max-w-md p-5"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={confirmTone === 'primary' ? 'primary' : 'danger'}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

type ConfirmRequest = {
  title: string
  description: string
  confirmLabel?: string
  pendingLabel?: string
  confirmTone?: 'danger' | 'primary'
  action: () => Promise<void>
}

export function useConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [pending, setPending] = useState(false)

  function ask(next: ConfirmRequest) {
    if (pending) {
      return
    }
    setRequest(next)
  }

  const dialog = request ? (
    <ConfirmDialog
      title={request.title}
      description={request.description}
      confirmLabel={request.confirmLabel}
      pendingLabel={request.pendingLabel}
      confirmTone={request.confirmTone}
      pending={pending}
      onCancel={() => {
        if (!pending) {
          setRequest(null)
        }
      }}
      onConfirm={() => {
        void (async () => {
          setPending(true)
          try {
            await request.action()
            setRequest(null)
          } catch {
            // Page handlers surface the error; keep the dialog open.
          } finally {
            setPending(false)
          }
        })()
      }}
    />
  ) : null

  return { ask, dialog }
}
