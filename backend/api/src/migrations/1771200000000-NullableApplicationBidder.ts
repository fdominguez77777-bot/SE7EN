import { MigrationInterface, QueryRunner } from 'typeorm';

export class NullableApplicationBidder1771200000000 implements MigrationInterface {
  name = 'NullableApplicationBidder1771200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
      BEGIN
        FOR rec IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
          WHERE rel.relname = 'job_application'
            AND con.contype = 'f'
            AND att.attname IN ('bidderId', 'created_by')
        LOOP
          EXECUTE format('ALTER TABLE "job_application" DROP CONSTRAINT %I', rec.conname);
        END LOOP;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "job_application" ALTER COLUMN "bidderId" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "job_application"
        ADD CONSTRAINT "FK_job_application_bidder"
        FOREIGN KEY ("bidderId") REFERENCES "user"("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "job_application"
        ADD CONSTRAINT "FK_job_application_created_by"
        FOREIGN KEY ("created_by") REFERENCES "user"("id")
        ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "job_application" DROP CONSTRAINT IF EXISTS "FK_job_application_created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" DROP CONSTRAINT IF EXISTS "FK_job_application_bidder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "job_application" ALTER COLUMN "bidderId" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "job_application"
        ADD CONSTRAINT "job_application_bidderId_fkey"
        FOREIGN KEY ("bidderId") REFERENCES "user"("id")
        ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "job_application"
        ADD CONSTRAINT "job_application_created_by_fkey"
        FOREIGN KEY ("created_by") REFERENCES "user"("id")
        ON DELETE RESTRICT
    `);
  }
}
