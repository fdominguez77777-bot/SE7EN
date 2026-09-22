import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoginHistory1772000000000 implements MigrationInterface {
  name = 'LoginHistory1772000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "login_history" (
        "id" SERIAL NOT NULL,
        "userId" integer NOT NULL,
        "username" character varying(120) NOT NULL,
        "displayName" character varying(160) NOT NULL,
        "role" character varying(40) NOT NULL,
        "ipAddress" character varying(64) NOT NULL,
        "country" character varying(80),
        "region" character varying(120),
        "city" character varying(120),
        "userAgent" character varying(512),
        "device" character varying(40),
        "browser" character varying(40),
        "os" character varying(40),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_login_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_login_history_user" FOREIGN KEY ("userId")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_userId" ON "login_history" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_login_history_createdAt" ON "login_history" ("createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "login_history"`);
  }
}
