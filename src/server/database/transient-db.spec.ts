import { isTransientDbError } from './transient-db'

describe('isTransientDbError', () => {
  it('recognizes a dropped hosted-database connection', () => {
    expect(isTransientDbError(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }))).toBe(true)
    expect(
      isTransientDbError(
        Object.assign(new Error('getaddrinfo ENOTFOUND seven.example.com'), { code: 'ENOTFOUND' }),
      ),
    ).toBe(true)
    expect(isTransientDbError(new Error('Connection terminated unexpectedly'))).toBe(true)
  })

  it('ignores ordinary query and HTTP failures', () => {
    expect(isTransientDbError(new Error('duplicate key value'))).toBe(false)
    expect(isTransientDbError({ statusCode: 400, message: 'Bad request' })).toBe(false)
  })

  it('looks through a driver error wrapper', () => {
    expect(
      isTransientDbError({
        message: 'Query failed',
        driverError: { code: 'ECONNRESET', message: 'read ECONNRESET' },
      }),
    ).toBe(true)
  })
})
