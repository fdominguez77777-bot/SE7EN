import { MigrationInterface, QueryRunner } from 'typeorm';

export class DailySubmissionUnread1771000000000 implements MigrationInterface {
  name = 'DailySubmissionUnread1771000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "daily_submission"
      ADD COLUMN IF NOT EXISTS "contentChangedAt" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      UPDATE "daily_submission"
      SET "contentChangedAt" = "submittedAt"
      WHERE "contentChangedAt" IS NULL AND "submittedAt" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "daily_submission_read" (
        "id" SERIAL PRIMARY KEY,
        "userId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "dailySubmissionId" INTEGER NOT NULL REFERENCES "daily_submission"("id") ON DELETE CASCADE,
        "readAt" TIMESTAMPTZ NOT NULL,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE ("userId", "dailySubmissionId")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_submission_read"`);
    await queryRunner.query(
      `ALTER TABLE "daily_submission" DROP COLUMN IF EXISTS "contentChangedAt"`,
    );
  }
}
