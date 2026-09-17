import { MigrationInterface, QueryRunner } from 'typeorm';

export class TalynApplicationId1771300000000 implements MigrationInterface {
  name = 'TalynApplicationId1771300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job_application" ADD COLUMN IF NOT EXISTS "talynApplicationId" VARCHAR`,
    );
    await queryRunner.query(`
      UPDATE "job_application"
      SET "talynApplicationId" = "sourceExternalId"
      WHERE "source" = 'TALYN'
        AND "sourceExternalId" IS NOT NULL
        AND "talynApplicationId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_job_application_talynApplicationId"
      ON "job_application" ("talynApplicationId")
      WHERE "talynApplicationId" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_job_application_talynApplicationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" DROP COLUMN IF EXISTS "talynApplicationId"`,
    );
  }
}
