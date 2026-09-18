import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletOwner1771800000000 implements MigrationInterface {
  name = 'WalletOwner1771800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" ADD COLUMN IF NOT EXISTS "ownerUserId" integer`,
    );
    await queryRunner.query(`
      UPDATE "wallet_transaction"
      SET "ownerUserId" = "createdByUserId"
      WHERE "ownerUserId" IS NULL AND "createdByUserId" IS NOT NULL
    `);
    await queryRunner.query(
      `DELETE FROM "wallet_transaction" WHERE "ownerUserId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" ALTER COLUMN "ownerUserId" SET NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_wallet_transaction_owner'
        ) THEN
          ALTER TABLE "wallet_transaction"
            ADD CONSTRAINT "FK_wallet_transaction_owner"
            FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_transaction_owner_occurredOn" ON "wallet_transaction" ("ownerUserId", "occurredOn")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_wallet_transaction_owner_occurredOn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" DROP CONSTRAINT IF EXISTS "FK_wallet_transaction_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet_transaction" DROP COLUMN IF EXISTS "ownerUserId"`,
    );
  }
}
