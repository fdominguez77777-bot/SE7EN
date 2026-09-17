import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4Procurement1767129600000 implements MigrationInterface {
  name = 'Phase4Procurement1767129600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "opensAt" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "closesAt" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "awarded_submission_id" INTEGER`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`,
    );

    await queryRunner.query(
      `ALTER TABLE "bid_submission" ADD COLUMN IF NOT EXISTS "amount" NUMERIC(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "bid_submission" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT 'USD'`,
    );
    await queryRunner.query(
      `UPDATE "bid_submission" SET "amount" = 0 WHERE "amount" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "bid_submission" ALTER COLUMN "amount" SET DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "bid_submission" ALTER COLUMN "amount" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "contactName" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "email" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "phone" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "address" TEXT`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_event" (
        "id" SERIAL PRIMARY KEY,
        "entityType" VARCHAR NOT NULL,
        "entityId" INTEGER NOT NULL,
        "action" VARCHAR NOT NULL,
        "actorId" INTEGER,
        "payload" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_event"`);
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" DROP COLUMN IF EXISTS "contactName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" DROP COLUMN IF EXISTS "email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" DROP COLUMN IF EXISTS "phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" DROP COLUMN IF EXISTS "address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bid_submission" DROP COLUMN IF EXISTS "amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bid_submission" DROP COLUMN IF EXISTS "currency"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN IF EXISTS "opensAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN IF EXISTS "closesAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN IF EXISTS "awarded_submission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "status" SET DEFAULT 'OPEN'`,
    );
  }
}
