'use client'

import { type FormEvent, useState } from 'react'

import { api, getApiErrorMessage } from '../api/client'
import { Button } from './chrome'
import { PasswordField } from './password-field'

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation must match.')
      return
    }
    setError('')
    setPending(true)
    try {
      await api.patch('/users/me/password', {
        currentPassword,
        newPassword,
      })
      onClose()
    } catch (err) {
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
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="dialog-panel glass-raised relative z-10 w-full max-w-md p-5"
        onSubmit={onSubmit}
      >
        <h2
          id="change-password-title"
          className="text-lg font-semibold text-[var(--text-primary)]"
        >
          Change password
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Use your current sign-in password, then choose a new one of at least 8
          characters.
        </p>
        <label className="mt-5 block text-sm">
          <span className="text-[var(--text-secondary)]">Current password</span>
          <PasswordField
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-[var(--text-secondary)]">New password</span>
          <PasswordField
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={newPassword}
            onChange={setNewPassword}
            required
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-[var(--text-secondary)]">Confirm new password</span>
          <PasswordField
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-[#dd8080]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save password'}
          </Button>
        </div>
      </form>
    </div>
  )
}
