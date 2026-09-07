import axios, { type AxiosError } from 'axios'

const TOKEN_KEY = 'bp_access_token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(TOKEN_KEY)
}

export function resolveApiBaseUrl() {
  return '/api'
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function isAuthFailure(error: unknown) {
  const status = (error as AxiosError).response?.status
  return status === 401 || status === 403
}

export function isUnreachable(error: unknown) {
  const axiosError = error as AxiosError
  if (!axiosError.response) {
    return true
  }
  return axiosError.response.status >= 500
}

export function getApiErrorMessage(error: unknown): string {
  const axiosError = error as AxiosError<{ message?: string | string[] }>
  const message = axiosError.response?.data?.message
  if (Array.isArray(message)) {
    return message.join(', ')
  }
  if (typeof message === 'string') {
    return message
  }
  if (axiosError.response?.status === 413) {
    return 'Photo must be 5 MB or smaller.'
  }
  return axiosError.message || 'Request failed'
}

export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined
  }
  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url
  }
  const base = resolveApiBaseUrl().replace(/\/$/, '')
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`
}
