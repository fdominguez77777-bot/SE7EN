import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskAssignees1772300000000 implements MigrationInterface {
  name = 'TaskAssignees1772300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_assignee" (
        "taskId" integer NOT NULL,
        "userId" integer NOT NULL,
        CONSTRAINT "PK_task_assignee" PRIMARY KEY ("taskId", "userId"),
        CONSTRAINT "FK_task_assignee_task" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_assignee_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_assignee_user" ON "task_assignee" ("userId")`,
    );
    await queryRunner.query(`
      INSERT INTO "task_assignee" ("taskId", "userId")
      SELECT "id", "assigneeUserId" FROM "task"
      WHERE "assigneeUserId" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_task_assignee_status"`);
    await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "FK_task_assignee"`);
    await queryRunner.query(`ALTER TABLE "task" DROP COLUMN IF EXISTS "assigneeUserId"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "assigneeUserId" integer`);
    await queryRunner.query(`
      UPDATE "task" t SET "assigneeUserId" = (
        SELECT MIN(ta."userId") FROM "task_assignee" ta WHERE ta."taskId" = t."id"
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "task" ADD CONSTRAINT "FK_task_assignee"
      FOREIGN KEY ("assigneeUserId") REFERENCES "user"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_assignee_status" ON "task" ("assigneeUserId", "status")`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "task_assignee"`);
  }
}
