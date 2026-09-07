import { MigrationInterface, QueryRunner } from 'typeorm';

export class JobApplication1770200000000 implements MigrationInterface {
  name = 'JobApplication1770200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "job_application" (
        "id" SERIAL PRIMARY KEY,
        "candidate_profile_id" INTEGER NOT NULL REFERENCES "bidder_profile"("id") ON DELETE RESTRICT,
        "bidderId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "created_by" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "companyName" VARCHAR NOT NULL,
        "jobTitle" VARCHAR NOT NULL,
        "location" VARCHAR,
        "jobUrl" VARCHAR,
        "source" VARCHAR NOT NULL DEFAULT 'MANUAL',
        "sourceExternalId" VARCHAR,
        "appliedAt" TIMESTAMPTZ NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'APPLIED',
        "jobDescriptionText" TEXT,
        "resumeText" TEXT,
        "notes" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_application_candidate" ON "job_application" ("candidate_profile_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_application_bidderId" ON "job_application" ("bidderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_application_appliedAt" ON "job_application" ("appliedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_job_application_status" ON "job_application" ("status")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_job_application_source_external"
      ON "job_application" ("source", "sourceExternalId")
      WHERE "sourceExternalId" IS NOT NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "activity_event" ADD COLUMN IF NOT EXISTS "jobApplicationId" INTEGER`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_event_jobApplicationId" ON "activity_event" ("jobApplicationId")`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_activity_event_job_application'
        ) THEN
          ALTER TABLE "activity_event"
            ADD CONSTRAINT "FK_activity_event_job_application"
            FOREIGN KEY ("jobApplicationId") REFERENCES "job_application"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_event" DROP CONSTRAINT IF EXISTS "FK_activity_event_job_application"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_event_jobApplicationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_event" DROP COLUMN IF EXISTS "jobApplicationId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "job_application"`);
  }
}
