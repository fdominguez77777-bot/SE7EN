import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableApplicationCreatedBy1770400000000 implements MigrationInterface {
  name = 'NullableApplicationCreatedBy1770400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job_application" ALTER COLUMN "created_by" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_event" ALTER COLUMN "created_by" DROP NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_event" ALTER COLUMN "created_by" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" ALTER COLUMN "created_by" SET NOT NULL`,
    );
  }
}
