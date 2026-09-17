import { MigrationInterface, QueryRunner } from 'typeorm';

export class CandidateAssignedBidder1770000000000 implements MigrationInterface {
  name = 'CandidateAssignedBidder1770000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" ADD COLUMN IF NOT EXISTS "assignedBidderId" INTEGER`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bidder_profile_assignedBidderId" ON "bidder_profile" ("assignedBidderId")`,
    );

    await queryRunner.query(`
      UPDATE "bidder_profile" AS profile
      SET "assignedBidderId" = bidder.id
      FROM "user" AS bidder
      WHERE bidder."bidderProfileId" = profile.id
        AND bidder.role = 'BIDDER'
        AND profile."assignedBidderId" IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_bidder_profile_assignedBidder'
        ) THEN
          ALTER TABLE "bidder_profile"
            ADD CONSTRAINT "FK_bidder_profile_assignedBidder"
            FOREIGN KEY ("assignedBidderId") REFERENCES "user"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user" AS bidder
      SET "bidderProfileId" = (
        SELECT profile.id
        FROM "bidder_profile" AS profile
        WHERE profile."assignedBidderId" = bidder.id
        ORDER BY profile.id
        LIMIT 1
      )
      WHERE bidder.role = 'BIDDER'
    `);

    await queryRunner.query(
      `ALTER TABLE "bidder_profile" DROP CONSTRAINT IF EXISTS "FK_bidder_profile_assignedBidder"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bidder_profile_assignedBidderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bidder_profile" DROP COLUMN IF EXISTS "assignedBidderId"`,
    );
  }
}
