export const DB_UNREACHABLE_MESSAGE =
  'The database is temporarily unreachable. Try again in a moment.'

const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P01',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '53300',
])

const TRANSIENT_MESSAGE =
  /ETIMEDOUT|ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|EHOSTUNREACH|Connection terminated|Connection ended unexpectedly|getaddrinfo/i

export function isTransientDbError(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const record = current as {
      code?: unknown
      message?: unknown
      driverError?: unknown
      cause?: unknown
    }
    if (typeof record.code === 'string' && TRANSIENT_CODES.has(record.code)) {
      return true
    }
    if (typeof record.message === 'string' && TRANSIENT_MESSAGE.test(record.message)) {
      return true
    }
    current = record.driverError ?? record.cause
  }
  return false
}
