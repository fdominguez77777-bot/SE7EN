import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserRoles1772800000000 implements MigrationInterface {
  name = 'UserRoles1772800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS "roles" text[] NOT NULL DEFAULT '{BIDDER}'
    `);
    await queryRunner.query(`
      UPDATE "user"
      SET "roles" = ARRAY[COALESCE("role", 'BIDDER')]::text[]
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "roles"`);
  }
}
