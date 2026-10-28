import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarEventMark1772900000000 implements MigrationInterface {
  name = 'CalendarEventMark1772900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "calendar_event_mark" (
        "id" SERIAL PRIMARY KEY,
        "eventKey" varchar(1024) NOT NULL,
        "kind" varchar(16) NOT NULL,
        "updatedById" int NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_calendar_event_mark_eventKey"
      ON "calendar_event_mark" ("eventKey")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "calendar_event_mark"`);
  }
}
