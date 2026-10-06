import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarSync1772600000000 implements MigrationInterface {
  name = 'CalendarSync1772600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_account" ADD COLUMN IF NOT EXISTS "syncError" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_connect_link" ADD COLUMN IF NOT EXISTS "redirectOrigin" varchar NULL`,
    );
    await queryRunner.query(`
      UPDATE "calendar_connect_link"
      SET "expiresAt" = NOW() + INTERVAL '365 days'
      WHERE "expiresAt" < NOW() + INTERVAL '60 days'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_connect_link" DROP COLUMN IF EXISTS "redirectOrigin"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_account" DROP COLUMN IF EXISTS "syncError"`,
    );
  }
}
