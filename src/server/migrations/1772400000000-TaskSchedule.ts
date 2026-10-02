import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskSchedule1772400000000 implements MigrationInterface {
  name = 'TaskSchedule1772400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "task"
        ADD COLUMN IF NOT EXISTS "repeat" character varying NOT NULL DEFAULT 'NONE',
        ADD COLUMN IF NOT EXISTS "repeatDays" smallint,
        ADD COLUMN IF NOT EXISTS "startDate" date,
        ADD COLUMN IF NOT EXISTS "endDate" date
    `);
    await queryRunner.query(`
      UPDATE "task"
      SET "startDate" = COALESCE("startDate", ("created_at" AT TIME ZONE 'UTC')::date),
          "dueDate" = COALESCE("dueDate", ("created_at" AT TIME ZONE 'UTC')::date)
    `);
    await queryRunner.query(`ALTER TABLE "task" ALTER COLUMN "startDate" SET DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "task" ALTER COLUMN "startDate" SET NOT NULL`);

    await queryRunner.query(`
      ALTER TABLE "task_assignee"
        ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_completion" (
        "taskId" integer NOT NULL,
        "occursOn" date NOT NULL,
        "completedByUserId" integer,
        "completedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_completion" PRIMARY KEY ("taskId", "occursOn"),
        CONSTRAINT "FK_task_completion_task" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_completion_user" FOREIGN KEY ("completedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_completion_occursOn" ON "task_completion" ("occursOn")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "task_completion"`);
    await queryRunner.query(`ALTER TABLE "task_assignee" DROP COLUMN IF EXISTS "assignedAt"`);
    await queryRunner.query(`
      ALTER TABLE "task"
        DROP COLUMN IF EXISTS "endDate",
        DROP COLUMN IF EXISTS "startDate",
        DROP COLUMN IF EXISTS "repeatDays",
        DROP COLUMN IF EXISTS "repeat"
    `);
  }
}
