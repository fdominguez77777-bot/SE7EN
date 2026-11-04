import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarEventMarkOtherReason1773000000000 implements MigrationInterface {
  name = 'CalendarEventMarkOtherReason1773000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "calendar_event_mark"
      ADD COLUMN IF NOT EXISTS "otherReason" varchar(280) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "calendar_event_mark"
      DROP COLUMN IF EXISTS "otherReason"
    `);
  }
}
