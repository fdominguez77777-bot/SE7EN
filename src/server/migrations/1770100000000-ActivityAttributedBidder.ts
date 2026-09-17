import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityAttributedBidder1770100000000 implements MigrationInterface {
  name = 'ActivityAttributedBidder1770100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_event" ADD COLUMN IF NOT EXISTS "bidderId" INTEGER`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_event_bidderId_occurredAt" ON "activity_event" ("bidderId", "occurredAt")`,
    );

    await queryRunner.query(`
      UPDATE "activity_event" AS event
      SET "bidderId" = profile."assignedBidderId"
      FROM "bidder_profile" AS profile
      WHERE event."candidate_profile_id" = profile.id
        AND event."bidderId" IS NULL
        AND profile."assignedBidderId" IS NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_activity_event_bidder'
        ) THEN
          ALTER TABLE "activity_event"
            ADD CONSTRAINT "FK_activity_event_bidder"
            FOREIGN KEY ("bidderId") REFERENCES "user"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity_event" DROP CONSTRAINT IF EXISTS "FK_activity_event_bidder"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_activity_event_bidderId_occurredAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_event" DROP COLUMN IF EXISTS "bidderId"`,
    );
  }
}
