import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { getApiErrorMessage } from '../api/client'
import { homePathForRole, useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { token, user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (token && user) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const nextUser = await login(email, password)
      navigate(homePathForRole(nextUser.role), { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-200">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-stone-300 bg-white p-8"
      >
        <p className="text-xs tracking-[0.2em] text-stone-500 uppercase">
          BidderPlatform
        </p>
        <h1 className="mt-2 text-2xl font-medium text-stone-900">Sign in</h1>
        <p className="mt-2 text-sm text-stone-600">
          Use your account email and password.
        </p>
        <label className="mt-6 block text-sm text-stone-700">
          Email
          <input
            className="mt-1 w-full border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-stone-700"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm text-stone-700">
          Password
          <input
            className="mt-1 w-full border border-stone-300 px-3 py-2 text-stone-900 outline-none focus:border-stone-700"
            type="password"
            autoComplete="current-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="mt-4 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full bg-stone-900 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
