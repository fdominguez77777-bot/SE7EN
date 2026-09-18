'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  api,
  clearStoredToken,
  getStoredToken,
  isAuthFailure,
  setStoredToken,
} from '../api/client'
import type { AuthResponse, Role, User } from '../api/types'

const USER_KEY = 'bp_user'

function readStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AuthState = {
  user: User | null
  token: string | null
  status: AuthStatus
  workspaceError: boolean
  message: string
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  retry: () => void
  applyUser: (next: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [workspaceError, setWorkspaceError] = useState(false)
  const [message, setMessage] = useState('Preparing your workspace…')
  const [retryKey, setRetryKey] = useState(0)

  const logout = useCallback(() => {
    clearStoredToken()
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setWorkspaceError(false)
    setStatus('unauthenticated')
    setMessage('Preparing your workspace…')
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    })
    setStoredToken(data.accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    setToken(data.accessToken)
    setUser(data.user)
    setWorkspaceError(false)
    setStatus('authenticated')
    setMessage('Preparing your workspace…')
    return data.user
  }, [])

  const retry = useCallback(() => {
    setWorkspaceError(false)
    setMessage('Preparing your workspace…')
    setStatus('loading')
    setRetryKey((value) => value + 1)
  }, [])

  const applyUser = useCallback((next: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next))
    setUser(next)
  }, [])

  useEffect(() => {
    const stored = getStoredToken()
    const storedUser = readStoredUser()
    if (!stored) {
      setStatus('unauthenticated')
      setUser(null)
      setToken(null)
      setWorkspaceError(false)
      return
    }
    if (storedUser) {
      setToken(stored)
      setUser(storedUser)
      setStatus('authenticated')
    } else {
      setStatus('loading')
      setMessage('Verifying access…')
    }
    let cancelled = false
    api
      .get<User>('/users/me')
      .then(({ data }) => {
        if (cancelled) {
          return
        }
        localStorage.setItem(USER_KEY, JSON.stringify(data))
        setUser(data)
        setToken(stored)
        setWorkspaceError(false)
        setStatus('authenticated')
      })
      .catch((error) => {
        if (cancelled) {
          return
        }
        if (isAuthFailure(error)) {
          clearStoredToken()
          localStorage.removeItem(USER_KEY)
          setToken(null)
          setUser(null)
          setWorkspaceError(false)
          setStatus('unauthenticated')
          return
        }
        if (storedUser) {
          setToken(stored)
          setUser(storedUser)
          setWorkspaceError(false)
          setStatus('authenticated')
          return
        }
        setWorkspaceError(true)
      })
    return () => {
      cancelled = true
    }
  }, [retryKey])

  useEffect(() => {
    const id = api.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = String(error.config?.url ?? '')
        const bootstrap = url.includes('/users/me')
        if (
          error.response?.status === 401 &&
          !url.includes('/auth/login') &&
          !bootstrap
        ) {
          logout()
        }
        return Promise.reject(error)
      },
    )
    return () => api.interceptors.response.eject(id)
  }, [logout])

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      workspaceError,
      message,
      login,
      logout,
      retry,
      applyUser,
    }),
    [user, token, status, workspaceError, message, login, logout, retry, applyUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function homePathForRole(_role: Role): string {
  return '/'
}
