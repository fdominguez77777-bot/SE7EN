import { MigrationInterface, QueryRunner } from 'typeorm';

export class InterviewApplicationLink1770300000000 implements MigrationInterface {
  name = 'InterviewApplicationLink1770300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interview" ADD COLUMN IF NOT EXISTS "jobApplicationId" INTEGER`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview" ADD COLUMN IF NOT EXISTS "status" VARCHAR NOT NULL DEFAULT 'SCHEDULED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview" ADD COLUMN IF NOT EXISTS "method" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview" ADD COLUMN IF NOT EXISTS "bidderId" INTEGER`,
    );

    await queryRunner.query(`
      UPDATE "interview"
      SET "status" = CASE
        WHEN "startsAt" < NOW() THEN 'COMPLETED'
        ELSE 'SCHEDULED'
      END
    `);

    await queryRunner.query(`
      UPDATE "interview" AS i
      SET "bidderId" = p."assignedBidderId"
      FROM "bidder_profile" AS p
      WHERE p."id" = i."candidate_profile_id"
        AND i."bidderId" IS NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_interview_jobApplicationId" ON "interview" ("jobApplicationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_interview_status" ON "interview" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_interview_startsAt" ON "interview" ("startsAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_interview_bidderId" ON "interview" ("bidderId")`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_interview_job_application'
        ) THEN
          ALTER TABLE "interview"
            ADD CONSTRAINT "FK_interview_job_application"
            FOREIGN KEY ("jobApplicationId") REFERENCES "job_application"("id")
            ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_interview_bidder'
        ) THEN
          ALTER TABLE "interview"
            ADD CONSTRAINT "FK_interview_bidder"
            FOREIGN KEY ("bidderId") REFERENCES "user"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "interview" DROP CONSTRAINT IF EXISTS "FK_interview_job_application"`,
    );
    await queryRunner.query(
      `ALTER TABLE "interview" DROP CONSTRAINT IF EXISTS "FK_interview_bidder"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_jobApplicationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_startsAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_interview_bidderId"`);
    await queryRunner.query(
      `ALTER TABLE "interview" DROP COLUMN IF EXISTS "jobApplicationId"`,
    );
    await queryRunner.query(`ALTER TABLE "interview" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "interview" DROP COLUMN IF EXISTS "method"`);
    await queryRunner.query(
      `ALTER TABLE "interview" DROP COLUMN IF EXISTS "bidderId"`,
    );
  }
}
