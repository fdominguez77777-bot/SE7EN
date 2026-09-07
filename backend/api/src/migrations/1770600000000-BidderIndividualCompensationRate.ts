import { MigrationInterface, QueryRunner } from 'typeorm';

export class BidderIndividualCompensationRate1770600000000
  implements MigrationInterface
{
  name = 'BidderIndividualCompensationRate1770600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bidder_individual_compensation_rate" (
        "id" SERIAL PRIMARY KEY,
        "bidderId" INTEGER NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        "applicationRate" NUMERIC(10,4) NOT NULL,
        "interviewRate" NUMERIC(10,4) NOT NULL,
        "effectiveFrom" TIMESTAMPTZ NOT NULL,
        "effectiveTo" TIMESTAMPTZ,
        "createdByUserId" INTEGER REFERENCES "user"("id") ON DELETE SET NULL,
        "notes" TEXT,
        "created_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bidder_individual_rate_bidderId" ON "bidder_individual_compensation_rate" ("bidderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bidder_individual_rate_bidder_effectiveFrom" ON "bidder_individual_compensation_rate" ("bidderId", "effectiveFrom")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "bidder_individual_compensation_rate"`,
    );
  }
}
