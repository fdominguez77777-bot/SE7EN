import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletTransaction1771700000000 implements MigrationInterface {
  name = 'WalletTransaction1771700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wallet_transaction" (
        "id" SERIAL NOT NULL,
        "occurredOn" date NOT NULL,
        "type" character varying NOT NULL,
        "direction" character varying NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "counterparty" character varying NOT NULL,
        "method" character varying NOT NULL,
        "reference" character varying,
        "notes" character varying,
        "status" character varying NOT NULL DEFAULT 'POSTED',
        "createdByUserId" integer,
        "voidedByUserId" integer,
        "voidedAt" TIMESTAMPTZ,
        "voidReason" character varying,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wallet_transaction" PRIMARY KEY ("id"),
        CONSTRAINT "FK_wallet_transaction_createdBy" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_wallet_transaction_voidedBy" FOREIGN KEY ("voidedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_transaction_occurredOn_id" ON "wallet_transaction" ("occurredOn", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_transaction_status_occurredOn" ON "wallet_transaction" ("status", "occurredOn")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_wallet_transaction_type_occurredOn" ON "wallet_transaction" ("type", "occurredOn")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wallet_transaction"`);
  }
}
