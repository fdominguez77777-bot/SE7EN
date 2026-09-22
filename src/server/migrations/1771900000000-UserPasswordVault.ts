import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPasswordVault1771900000000 implements MigrationInterface {
  name = 'UserPasswordVault1771900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordVault" character varying`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "passwordVault"`,
    );
  }
}
