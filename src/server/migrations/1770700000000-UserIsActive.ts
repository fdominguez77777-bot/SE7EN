import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIsActive1770700000000 implements MigrationInterface {
  name = 'UserIsActive1770700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "isActive"`,
    );
  }
}
