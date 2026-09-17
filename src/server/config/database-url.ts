export type DatabaseConnection = {
  host: string
  port: number
  username: string
  password: string
  database: string
}

export function parseDatabaseUrl(url: string): DatabaseConnection | null {
  const trimmed = url.trim()
  if (!trimmed) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    return null
  }
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] ?? ''),
  }
}

export function applyDatabaseUrl(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const fromUrl = parseDatabaseUrl(String(config.DATABASE_URL ?? ''))
  if (!fromUrl) {
    return config
  }
  return {
    ...config,
    DATABASE_HOST: fromUrl.host,
    DATABASE_PORT: String(fromUrl.port),
    DATABASE_USER: fromUrl.username,
    DATABASE_PASSWORD: fromUrl.password,
    DATABASE_NAME: fromUrl.database,
  }
}

function sslModeFromUrl(url: string): string | null {
  try {
    return new URL(url.trim()).searchParams.get('sslmode')?.toLowerCase() ?? null
  } catch {
    return null
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url.trim()).hostname || ''
  } catch {
    return ''
  }
}

function isLoopbackHost(host: string): boolean {
  const value = host.toLowerCase()
  return value === 'localhost' || value === '127.0.0.1' || value === '::1'
}

/** Enable TLS for hosted Postgres (Aiven, Neon, Vercel) even when NODE_ENV is development. */
export function postgresUsesSsl(input: {
  nodeEnv?: string
  databaseUrl?: string
  host?: string
}): boolean {
  const url = String(input.databaseUrl ?? '').trim()
  const sslmode = url ? sslModeFromUrl(url) : null
  if (sslmode === 'disable' || sslmode === 'allow') {
    return false
  }
  if (
    sslmode === 'require' ||
    sslmode === 'verify-ca' ||
    sslmode === 'verify-full' ||
    sslmode === 'prefer'
  ) {
    return true
  }
  const host = String(input.host || hostFromUrl(url) || '')
  if (host && !isLoopbackHost(host)) {
    return true
  }
  return input.nodeEnv === 'production'
}

export function isManagedPostgresSsl(
  nodeEnv: string | undefined,
  databaseUrl?: string,
  host?: string,
): boolean {
  return postgresUsesSsl({ nodeEnv, databaseUrl, host })
}
