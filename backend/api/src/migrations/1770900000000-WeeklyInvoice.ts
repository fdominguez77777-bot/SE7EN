import { MigrationInterface, QueryRunner } from 'typeorm';

export class WeeklyInvoice1770900000000 implements MigrationInterface {
  name = 'WeeklyInvoice1770900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "weekly_invoice" (
        "id" SERIAL PRIMARY KEY,
        "managerId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "periodStart" DATE NOT NULL,
        "periodEnd" DATE NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'DRAFT',
        "submittedAt" TIMESTAMPTZ,
        "reviewedAt" TIMESTAMPTZ,
        "reviewedByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "approvedAt" TIMESTAMPTZ,
        "approvedByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "managerNotes" TEXT,
        "noActivityDates" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "missingDayAcknowledgement" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("managerId", "periodStart", "periodEnd")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_weekly_invoice_periodStart" ON "weekly_invoice" ("periodStart")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_weekly_invoice_status" ON "weekly_invoice" ("status")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "weekly_invoice_bidder" (
        "id" SERIAL PRIMARY KEY,
        "weeklyInvoiceId" INTEGER NOT NULL REFERENCES "weekly_invoice"("id") ON DELETE CASCADE,
        "bidderId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "defaultApplicationCount" INTEGER NOT NULL DEFAULT 0,
        "invoiceApplicationCount" INTEGER NOT NULL DEFAULT 0,
        "configuredApplicationRate" NUMERIC(10,4) NOT NULL,
        "invoiceApplicationRate" NUMERIC(10,4) NOT NULL,
        "defaultInterviewCount" INTEGER NOT NULL DEFAULT 0,
        "invoiceInterviewCount" INTEGER NOT NULL DEFAULT 0,
        "configuredInterviewRate" NUMERIC(10,4) NOT NULL,
        "invoiceInterviewRate" NUMERIC(10,4) NOT NULL,
        "applicationDifference" INTEGER NOT NULL DEFAULT 0,
        "interviewDifference" INTEGER NOT NULL DEFAULT 0,
        "applicationAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "interviewAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "rateSource" VARCHAR NOT NULL DEFAULT 'default',
        "countAdjustmentReason" TEXT,
        "rateAdjustmentReason" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("weeklyInvoiceId", "bidderId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "weekly_invoice_daily_source" (
        "id" SERIAL PRIMARY KEY,
        "weeklyInvoiceId" INTEGER NOT NULL REFERENCES "weekly_invoice"("id") ON DELETE CASCADE,
        "reportingDate" DATE NOT NULL,
        "dailySubmissionId" INTEGER REFERENCES "daily_submission"("id") ON DELETE SET NULL,
        "status" VARCHAR NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("weeklyInvoiceId", "reportingDate")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "weekly_invoice_daily_bidder" (
        "id" SERIAL PRIMARY KEY,
        "weeklyInvoiceId" INTEGER NOT NULL REFERENCES "weekly_invoice"("id") ON DELETE CASCADE,
        "bidderId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "reportingDate" DATE NOT NULL,
        "applicationCount" INTEGER,
        "interviewCount" INTEGER,
        "included" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("weeklyInvoiceId", "bidderId", "reportingDate")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "weekly_invoice_daily_bidder"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "weekly_invoice_daily_source"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "weekly_invoice_bidder"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "weekly_invoice"`);
  }
}
