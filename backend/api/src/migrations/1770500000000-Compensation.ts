import { MigrationInterface, QueryRunner } from 'typeorm';

export class Compensation1770500000000 implements MigrationInterface {
  name = 'Compensation1770500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bidder_compensation_rate" (
        "id" SERIAL PRIMARY KEY,
        "applicationRate" NUMERIC(10,4) NOT NULL,
        "interviewRate" NUMERIC(10,4) NOT NULL,
        "effectiveFrom" TIMESTAMPTZ NOT NULL,
        "effectiveTo" TIMESTAMPTZ,
        "createdByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "notes" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bid_manager_compensation" (
        "id" SERIAL PRIMARY KEY,
        "managerId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "weeklySalary" NUMERIC(10,2) NOT NULL,
        "effectiveFrom" TIMESTAMPTZ NOT NULL,
        "effectiveTo" TIMESTAMPTZ,
        "createdByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "notes" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bid_manager_compensation_managerId" ON "bid_manager_compensation" ("managerId")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bidder_weekly_payment" (
        "id" SERIAL PRIMARY KEY,
        "bidderId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        "applicationCount" INTEGER NOT NULL,
        "interviewCount" INTEGER NOT NULL,
        "applicationRate" NUMERIC(10,4) NOT NULL,
        "interviewRate" NUMERIC(10,4) NOT NULL,
        "applicationPayAmount" NUMERIC(12,2) NOT NULL,
        "interviewPayAmount" NUMERIC(12,2) NOT NULL,
        "totalAmount" NUMERIC(12,2) NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'DRAFT',
        "reviewedByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "reviewedAt" TIMESTAMPTZ,
        "paidByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "paidAt" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bidder_weekly_payment_period" UNIQUE ("bidderId", "periodStart", "periodEnd")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bid_manager_weekly_payment" (
        "id" SERIAL PRIMARY KEY,
        "managerId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "periodStart" TIMESTAMPTZ NOT NULL,
        "periodEnd" TIMESTAMPTZ NOT NULL,
        "weeklySalaryRate" NUMERIC(10,2) NOT NULL,
        "totalAmount" NUMERIC(12,2) NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'DRAFT',
        "reviewedByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "reviewedAt" TIMESTAMPTZ,
        "paidByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "paidAt" TIMESTAMPTZ,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bid_manager_weekly_payment_period" UNIQUE ("managerId", "periodStart", "periodEnd")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bidder_compensation_rate_effectiveFrom" ON "bidder_compensation_rate" ("effectiveFrom")`,
    );
    await queryRunner.query(`
      INSERT INTO "bidder_compensation_rate"
        ("applicationRate", "interviewRate", "effectiveFrom", "notes")
      SELECT 0.0300, 1.0000, TIMESTAMPTZ '2020-01-01 00:00:00+00', 'Initial bidder performance rates'
      WHERE NOT EXISTS (SELECT 1 FROM "bidder_compensation_rate")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bid_manager_weekly_payment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bidder_weekly_payment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bid_manager_compensation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bidder_compensation_rate"`);
  }
}
