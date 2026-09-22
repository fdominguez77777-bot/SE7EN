import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoginHistoryLastSeen1772100000000 implements MigrationInterface {
  name = 'LoginHistoryLastSeen1772100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "login_history"
      ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      UPDATE "login_history"
      SET "lastSeenAt" = "createdAt"
      WHERE "lastSeenAt" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "login_history"
      ALTER COLUMN "lastSeenAt" SET DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "login_history"
      ALTER COLUMN "lastSeenAt" SET NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_lastSeenAt" ON "login_history" ("lastSeenAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_user_lastSeen" ON "login_history" ("userId", "lastSeenAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_login_history_user_lastSeen"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_login_history_lastSeenAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "login_history" DROP COLUMN IF EXISTS "lastSeenAt"`,
    );
  }
}
