import { useEffect, useRef, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import type { User } from '../api/types'
import { EntityAvatar } from './avatar'
import { Alert, Button } from './chrome'
import { ConfirmDialog } from './confirm-dialog'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp'

function validatePhoto(file: File): string | null {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  const allowedType =
    type === 'image/png' || type === 'image/jpeg' || type === 'image/webp'
  const allowedName =
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  if (!allowedType && !allowedName) {
    return 'Unsupported file type. Use PNG, JPG, or WEBP.'
  }
  if (file.size > MAX_BYTES) {
    return 'Photo must be 5 MB or smaller.'
  }
  return null
}

export function AvatarPhotoDialog({
  name,
  src,
  endpoint,
  onClose,
  onSaved,
}: {
  name: string
  src?: string | null
  endpoint: string
  onClose: () => void
  onSaved: (user: User) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  function chooseFile(next: File | null) {
    setError('')
    if (preview) {
      URL.revokeObjectURL(preview)
      setPreview(null)
    }
    if (!next) {
      setFile(null)
      return
    }
    const reason = validatePhoto(next)
    if (reason) {
      setFile(null)
      setError(reason)
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  async function save() {
    if (!file || pending) {
      return
    }
    setPending(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const { data } = await api.post<User>(endpoint, body)
      onSaved(data)
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  async function removePhoto() {
    if (pending) {
      return
    }
    setPending(true)
    setError('')
    try {
      const { data } = await api.delete<User>(endpoint)
      setConfirmRemove(false)
      onSaved(data)
    } catch (err) {
      setConfirmRemove(false)
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className={`dialog-root fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden ${
        pending ? 'dialog-pending' : ''
      }`}
    >
      <button
        type="button"
        className="dialog-overlay absolute inset-0 bg-[var(--overlay-bg)]"
        aria-label="Cancel"
        disabled={pending}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-photo-title"
        className="dialog-panel glass-raised relative z-10 w-full max-w-md p-5"
      >
        <h2
          id="avatar-photo-title"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          Profile photo
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          PNG, JPG, or WEBP. Maximum 5 MB.
        </p>
        <div className="mt-5 flex items-center gap-4">
          <EntityAvatar name={name} src={preview ?? src} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--text-primary)]">{name}</p>
            <p className="text-[13px] text-[var(--text-muted)]">
              {file ? file.name : src ? 'Current photo' : 'Initials will be used'}
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={ACCEPT}
          onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
        />
        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          {src && !file ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setConfirmRemove(true)}
            >
              Remove photo
            </Button>
          ) : null}
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {file || src ? 'Change photo' : 'Upload photo'}
          </Button>
          <Button disabled={pending || !file} onClick={() => void save()}>
            {pending && file ? 'Uploading…' : 'Save'}
          </Button>
        </div>
      </div>
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove profile photo?"
          description={`${name} will use initials until a new photo is uploaded. This cannot be undone.`}
          confirmLabel="Remove photo"
          pendingLabel="Removing…"
          pending={pending}
          onCancel={() => {
            if (!pending) {
              setConfirmRemove(false)
            }
          }}
          onConfirm={() => void removePhoto()}
        />
      ) : null}
    </div>
  )
}
