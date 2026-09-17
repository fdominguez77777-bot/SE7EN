import { applyDatabaseUrl, parseDatabaseUrl } from './database-url'

describe('parseDatabaseUrl', () => {
  it('reads neon-style connection strings', () => {
    expect(
      parseDatabaseUrl(
        'postgresql://app:s3cret@db.example.com:5432/se7en?sslmode=require',
      ),
    ).toEqual({
      host: 'db.example.com',
      port: 5432,
      username: 'app',
      password: 's3cret',
      database: 'se7en',
    })
  })
})

describe('applyDatabaseUrl', () => {
  it('fills split DATABASE_* fields', () => {
    const next = applyDatabaseUrl({
      DATABASE_URL: 'postgres://user:pass@host:6543/dbname',
    })
    expect(next.DATABASE_HOST).toBe('host')
    expect(next.DATABASE_PORT).toBe('6543')
    expect(next.DATABASE_USER).toBe('user')
    expect(next.DATABASE_PASSWORD).toBe('pass')
    expect(next.DATABASE_NAME).toBe('dbname')
  })
})
