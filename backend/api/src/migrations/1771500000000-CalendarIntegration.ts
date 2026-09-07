import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarIntegration1771500000000 implements MigrationInterface {
  name = 'CalendarIntegration1771500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_account" (
        "id" SERIAL PRIMARY KEY,
        "provider" varchar NOT NULL,
        "email" varchar NOT NULL,
        "displayName" varchar NULL,
        "calendarId" varchar NULL,
        "accessToken" text NOT NULL,
        "refreshToken" text NULL,
        "accessExpiresAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_calendar_account_provider_email"
      ON "calendar_account" ("provider", "email")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_connect_link" (
        "id" SERIAL PRIMARY KEY,
        "tokenHash" varchar NOT NULL UNIQUE,
        "provider" varchar NOT NULL,
        "createdById" int NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_connect_link"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_account"`);
  }
}
