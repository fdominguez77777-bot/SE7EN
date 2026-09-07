import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from '../routing'

import { getApiErrorMessage } from '../api/client'
import { homePathForRole, useAuth } from '../auth/AuthContext'
import { BrandLogo } from '../ui/BrandLogo'
import { Alert, Button } from '../ui/chrome'
import { AppLoadingScreen, InlineSpinner } from '../ui/loading/AppLoadingScreen'

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (status === 'loading') {
    return <AppLoadingScreen message="Verifying access…" />
  }

  if (status === 'authenticated' && user) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (pending) {
      return
    }
    setError('')
    setPending(true)
    try {
      const nextUser = await login(email, password)
      navigate(homePathForRole(nextUser.role), { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
      setPending(false)
    }
  }

  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="glass-raised page-enter relative z-10 w-full max-w-[420px] p-8"
      >
        <div className="flex items-center gap-3">
          <BrandLogo size="lg" />
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">SE7EN</p>
            <p className="text-[11px] text-[var(--text-muted)]">Job Operations</p>
          </div>
        </div>
        <p className="mt-8 text-xs tracking-[0.2em] text-[var(--text-muted)] uppercase">
          Sign in
        </p>
        <h1 className="mt-2 text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Use your account email and password.
        </p>
        <label className="mt-6 block text-sm text-[var(--text-secondary)]">
          Email
          <input
            className="input-field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
          />
        </label>
        <label className="mt-4 block text-sm text-[var(--text-secondary)]">
          Password
          <input
            className="input-field"
            type="password"
            autoComplete="current-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={pending}
          />
        </label>
        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Button type="submit" disabled={pending} className="mt-6 w-full">
          {pending ? (
            <>
              <InlineSpinner />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </div>
  )
}
