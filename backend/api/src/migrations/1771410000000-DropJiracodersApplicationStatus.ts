import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropJiracodersApplicationStatus1771410000000
  implements MigrationInterface
{
  name = 'DropJiracodersApplicationStatus1771410000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "jiracoders_application_status"`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jiracoders_application_status" (
        "applicationId" INTEGER NOT NULL,
        "status" VARCHAR NOT NULL,
        "updatedByUserId" INTEGER,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_jiracoders_application_status" PRIMARY KEY ("applicationId")
      )
    `);
  }
}
