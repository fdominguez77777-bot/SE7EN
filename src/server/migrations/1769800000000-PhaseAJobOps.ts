import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseAJobOps1769800000000 implements MigrationInterface {
  name = 'PhaseAJobOps1769800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "firstName" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "middleName" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "lastName" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "phoneNumber" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "gender" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "dateOfBirth" DATE`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "streetAddress" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "city" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "stateRegion" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "zipPostalCode" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "linkedinUrl" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "githubUrl" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "portfolioUrl" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "raceEthnicity" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "veteranStatus" VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "disabilityStatus" VARCHAR`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "work_experience" (
        "id" SERIAL PRIMARY KEY,
        "candidate_profile_id" INTEGER NOT NULL REFERENCES "bidder_profile"("id") ON DELETE CASCADE,
        "companyName" VARCHAR NOT NULL,
        "industry" VARCHAR,
        "city" VARCHAR,
        "state" VARCHAR,
        "startDate" DATE NOT NULL,
        "endDate" DATE,
        "currentlyWorksHere" BOOLEAN NOT NULL DEFAULT false,
        "sortOrder" INTEGER NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "education" (
        "id" SERIAL PRIMARY KEY,
        "candidate_profile_id" INTEGER NOT NULL REFERENCES "bidder_profile"("id") ON DELETE CASCADE,
        "institutionName" VARCHAR NOT NULL,
        "degree" VARCHAR,
        "fromDate" DATE,
        "toDate" DATE,
        "sortOrder" INTEGER NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_event" (
        "id" SERIAL PRIMARY KEY,
        "candidate_profile_id" INTEGER NOT NULL REFERENCES "bidder_profile"("id") ON DELETE CASCADE,
        "type" VARCHAR NOT NULL,
        "delta" INTEGER NOT NULL,
        "source" VARCHAR NOT NULL DEFAULT 'MANUAL',
        "note" VARCHAR,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "interview" (
        "id" SERIAL PRIMARY KEY,
        "candidate_profile_id" INTEGER NOT NULL REFERENCES "bidder_profile"("id") ON DELETE CASCADE,
        "company" VARCHAR NOT NULL,
        "jobTitle" VARCHAR NOT NULL,
        "startsAt" TIMESTAMPTZ NOT NULL,
        "round" VARCHAR,
        "source" VARCHAR,
        "result" VARCHAR,
        "notes" TEXT,
        "created_by" INTEGER NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "interview"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_event"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "education"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_experience"`);
  }
}
