import { MigrationInterface, QueryRunner } from 'typeorm';

export class DailySubmission1770800000000 implements MigrationInterface {
  name = 'DailySubmission1770800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_submission" (
        "id" SERIAL PRIMARY KEY,
        "reportingDate" DATE NOT NULL,
        "managerId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "status" VARCHAR NOT NULL DEFAULT 'DRAFT',
        "submittedAt" TIMESTAMPTZ,
        "reviewedAt" TIMESTAMPTZ,
        "reviewedByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("managerId", "reportingDate")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_daily_submission_reportingDate" ON "daily_submission" ("reportingDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_daily_submission_status" ON "daily_submission" ("status")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_submission_bidder" (
        "id" SERIAL PRIMARY KEY,
        "dailySubmissionId" INTEGER NOT NULL REFERENCES "daily_submission"("id") ON DELETE CASCADE,
        "bidderId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "systemApplicationCount" INTEGER NOT NULL DEFAULT 0,
        "gmailConfirmedApplicationCount" INTEGER,
        "systemInterviewCount" INTEGER NOT NULL DEFAULT 0,
        "verifiedInterviewCount" INTEGER,
        "applicationDifference" INTEGER,
        "interviewDifference" INTEGER,
        "notes" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("dailySubmissionId", "bidderId")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_submission_bidder"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_submission"`);
  }
}
