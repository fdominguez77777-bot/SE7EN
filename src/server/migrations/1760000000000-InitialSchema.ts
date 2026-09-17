import { MigrationInterface, QueryRunner } from 'typeorm';

/** Baseline tables that older environments created via TypeORM synchronize. */
export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR NOT NULL,
        "email" VARCHAR NOT NULL,
        "password" VARCHAR NOT NULL,
        "role" VARCHAR NOT NULL DEFAULT 'BIDDER',
        "bidderProfileId" INTEGER,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bidder_profile" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR NOT NULL,
        "legalName" VARCHAR,
        "status" VARCHAR NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project" (
        "id" SERIAL PRIMARY KEY,
        "title" VARCHAR NOT NULL,
        "description" TEXT,
        "status" VARCHAR NOT NULL DEFAULT 'OPEN',
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bid_invitation" (
        "id" SERIAL PRIMARY KEY,
        "project_id" INTEGER NOT NULL,
        "bidder_profile_id" INTEGER NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'INVITED',
        "invited_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bid_submission" (
        "id" SERIAL PRIMARY KEY,
        "project_id" INTEGER NOT NULL,
        "bidder_profile_id" INTEGER NOT NULL,
        "invitation_id" INTEGER NOT NULL,
        "notes" TEXT,
        "status" VARCHAR NOT NULL DEFAULT 'DRAFT',
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bid_invitation_project_profile"
      ON "bid_invitation" ("project_id", "bidder_profile_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bid_submission_project_profile"
      ON "bid_submission" ("project_id", "bidder_profile_id")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_project_created_by'
        ) THEN
          ALTER TABLE "project"
            ADD CONSTRAINT "FK_project_created_by"
            FOREIGN KEY ("created_by") REFERENCES "user"("id");
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_invitation_project'
        ) THEN
          ALTER TABLE "bid_invitation"
            ADD CONSTRAINT "FK_bid_invitation_project"
            FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_invitation_profile'
        ) THEN
          ALTER TABLE "bid_invitation"
            ADD CONSTRAINT "FK_bid_invitation_profile"
            FOREIGN KEY ("bidder_profile_id") REFERENCES "bidder_profile"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_invitation_invited_by'
        ) THEN
          ALTER TABLE "bid_invitation"
            ADD CONSTRAINT "FK_bid_invitation_invited_by"
            FOREIGN KEY ("invited_by") REFERENCES "user"("id");
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_submission_project'
        ) THEN
          ALTER TABLE "bid_submission"
            ADD CONSTRAINT "FK_bid_submission_project"
            FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_submission_profile'
        ) THEN
          ALTER TABLE "bid_submission"
            ADD CONSTRAINT "FK_bid_submission_profile"
            FOREIGN KEY ("bidder_profile_id") REFERENCES "bidder_profile"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_submission_invitation'
        ) THEN
          ALTER TABLE "bid_submission"
            ADD CONSTRAINT "FK_bid_submission_invitation"
            FOREIGN KEY ("invitation_id") REFERENCES "bid_invitation"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bid_submission_created_by'
        ) THEN
          ALTER TABLE "bid_submission"
            ADD CONSTRAINT "FK_bid_submission_created_by"
            FOREIGN KEY ("created_by") REFERENCES "user"("id");
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bid_submission"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bid_invitation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bidder_profile"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
  }
}
