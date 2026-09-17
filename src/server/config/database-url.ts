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

export function isManagedPostgresSsl(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production'
}
