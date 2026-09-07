import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAvatar1771100000000 implements MigrationInterface {
  name = 'UserAvatar1771100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "avatarPath" varchar NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "avatarPath"`,
    );
  }
}