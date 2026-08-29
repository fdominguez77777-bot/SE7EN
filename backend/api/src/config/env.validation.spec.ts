import 'reflect-metadata';
import { validateEnvironment } from './env.validation';

const validEnv = {
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'bidder_platform',
  DB_SYNCHRONIZE: 'false',
  SWAGGER_ENABLED: 'true',
  JWT_SECRET: 'local-dev-jwt-secret-key',
};

describe('validateEnvironment', () => {
  it('accepts a complete configuration and coerces types', () => {
    const env = validateEnvironment(validEnv);

    expect(env.DATABASE_PORT).toBe(5432);
    expect(env.DB_SYNCHRONIZE).toBe(false);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.PORT).toBe(3000);
  });

  it('treats the string "false" as boolean false', () => {
    const env = validateEnvironment({
      ...validEnv,
      DB_SYNCHRONIZE: 'false',
    });

    expect(env.DB_SYNCHRONIZE).toBe(false);
  });

  it('rejects missing database settings', () => {
    expect(() =>
      validateEnvironment({
        CORS_ORIGIN: 'http://localhost:5173',
        SWAGGER_ENABLED: 'true',
        DB_SYNCHRONIZE: 'false',
      }),
    ).toThrow(/Environment validation failed/);
  });
});
