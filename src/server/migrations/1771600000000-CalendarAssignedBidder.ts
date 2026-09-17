import { MigrationInterface, QueryRunner } from 'typeorm';

export class CalendarAssignedBidder1771600000000 implements MigrationInterface {
  name = 'CalendarAssignedBidder1771600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_account" ADD COLUMN IF NOT EXISTS "assignedBidderId" int NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_connect_link" ADD COLUMN IF NOT EXISTS "assignedBidderId" int NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_connect_link" DROP COLUMN IF EXISTS "assignedBidderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_account" DROP COLUMN IF EXISTS "assignedBidderId"`,
    );
  }
}
