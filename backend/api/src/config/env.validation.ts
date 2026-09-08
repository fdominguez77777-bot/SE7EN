import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

import { applyDatabaseUrl } from './database-url';

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return false;
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return Number(value);
}

export class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV: string = 'development';

  @IsOptional()
  @Transform(({ value }) => toNumber(value) ?? 3000)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  CORS_ORIGIN: string;

  @IsOptional()
  @IsString()
  DATABASE_URL: string = '';

  @IsString()
  DATABASE_HOST: string;

  @Transform(({ value }) => toNumber(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number;

  @IsString()
  DATABASE_USER: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  DB_SYNCHRONIZE: boolean;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  SWAGGER_ENABLED: boolean;

  @IsString()
  @MinLength(16)
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN: string = '1d';

  /**
   * BidderPlatform internal ingest key. Not Talyn native authentication.
   * Leave unset to keep the machine ingest endpoint fail-closed.
   */
  @IsOptional()
  @IsString()
  TALYN_INGEST_API_KEY: string = '';

  /** Local directory for uploaded files. Swap FileStorageService for object storage later. */
  @IsOptional()
  @IsString()
  UPLOAD_DIR: string = 'uploads';

  /** JiraCoders API origin. Paths are appended as /api/pju/... */
  @IsOptional()
  @IsString()
  JIRACODERS_API_BASE_URL: string = 'https://api.jiracoders.com';

  /** Bearer token for JiraCoders PJU endpoints. Leave empty to fail closed. */
  @IsOptional()
  @IsString()
  JIRACODERS_API_TOKEN: string = '';

  /** Browser origin used in calendar connect links and OAuth redirects. */
  @IsOptional()
  @IsString()
  APP_PUBLIC_URL: string = '';

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID: string = '';

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET: string = '';

  @IsOptional()
  @IsString()
  MICROSOFT_CLIENT_ID: string = '';

  @IsOptional()
  @IsString()
  MICROSOFT_CLIENT_SECRET: string = '';
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(
    EnvironmentVariables,
    applyDatabaseUrl(config),
    {
      exposeDefaultValues: true,
    },
  );

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors
        .map((error) => error.toString())
        .join(', ')}`,
    );
  }

  return validated;
}
