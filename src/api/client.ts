import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'

const inflightGets = new Map<string, Promise<AxiosResponse>>()

function serializeParams(params: unknown) {
  if (!params || typeof params !== 'object') {
    return ''
  }
  return Object.entries(params as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('&')
}

function requestKey(config: InternalAxiosRequestConfig) {
  return `${(config.method ?? 'get').toLowerCase()} ${config.url ?? ''}?${serializeParams(config.params)}`
}

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
  timeout: 90_000,
})

const dispatch = axios.getAdapter(axios.defaults.adapter)

api.defaults.adapter = (config) => {
  if ((config.method ?? 'get').toLowerCase() !== 'get') {
    return dispatch(config)
  }
  const key = requestKey(config)
  const existing = inflightGets.get(key)
  if (existing) {
    return existing
  }
  const pending = Promise.resolve(dispatch(config)).finally(() => {
    inflightGets.delete(key)
  }) as Promise<AxiosResponse>
  inflightGets.set(key, pending)
  return pending
}

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  config.headers['Cache-Control'] = 'no-cache'
  config.headers.Pragma = 'no-cache'
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
