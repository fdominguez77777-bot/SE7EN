import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallerProfile1772700000000 implements MigrationInterface {
  name = 'CallerProfile1772700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "caller_profile" (
        "callerId" integer NOT NULL,
        "profileId" integer NOT NULL,
        "assignedById" integer NULL,
        "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_caller_profile" PRIMARY KEY ("callerId", "profileId"),
        CONSTRAINT "FK_caller_profile_caller" FOREIGN KEY ("callerId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_caller_profile_profile" FOREIGN KEY ("profileId") REFERENCES "bidder_profile"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_caller_profile_assigned_by" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_caller_profile_profile" ON "caller_profile" ("profileId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "caller_profile"`);
  }
}
