import { MigrationInterface, QueryRunner } from 'typeorm';

/** Each assignee completes their own daily task, so a completion belongs to one member. */
export class TaskCompletionPerMember1772500000000 implements MigrationInterface {
  name = 'TaskCompletionPerMember1772500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "task_completion" WHERE "completedByUserId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "task_completion" DROP CONSTRAINT IF EXISTS "PK_task_completion"`);
    await queryRunner.query(`ALTER TABLE "task_completion" DROP CONSTRAINT IF EXISTS "FK_task_completion_user"`);
    await queryRunner.query(`ALTER TABLE "task_completion" ALTER COLUMN "completedByUserId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "task_completion"
        ADD CONSTRAINT "PK_task_completion" PRIMARY KEY ("taskId", "occursOn", "completedByUserId"),
        ADD CONSTRAINT "FK_task_completion_user" FOREIGN KEY ("completedByUserId") REFERENCES "user"("id") ON DELETE CASCADE
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task_completion" DROP CONSTRAINT IF EXISTS "PK_task_completion"`);
    await queryRunner.query(`ALTER TABLE "task_completion" DROP CONSTRAINT IF EXISTS "FK_task_completion_user"`);
    await queryRunner.query(`
      DELETE FROM "task_completion" a USING "task_completion" b
      WHERE a."taskId" = b."taskId" AND a."occursOn" = b."occursOn" AND a."completedByUserId" > b."completedByUserId"
    `);
    await queryRunner.query(`ALTER TABLE "task_completion" ALTER COLUMN "completedByUserId" DROP NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "task_completion"
        ADD CONSTRAINT "PK_task_completion" PRIMARY KEY ("taskId", "occursOn"),
        ADD CONSTRAINT "FK_task_completion_user" FOREIGN KEY ("completedByUserId") REFERENCES "user"("id") ON DELETE SET NULL
    `);
  }
}
