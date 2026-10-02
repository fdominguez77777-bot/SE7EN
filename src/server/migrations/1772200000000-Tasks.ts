import { MigrationInterface, QueryRunner } from 'typeorm';

export class Tasks1772200000000 implements MigrationInterface {
  name = 'Tasks1772200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task" (
        "id" SERIAL NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'TODO',
        "priority" character varying NOT NULL DEFAULT 'MEDIUM',
        "type" character varying NOT NULL DEFAULT 'TASK',
        "dueDate" date,
        "completedAt" TIMESTAMPTZ,
        "reporterUserId" integer,
        "assigneeUserId" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_reporter" FOREIGN KEY ("reporterUserId") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_task_assignee" FOREIGN KEY ("assigneeUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_assignee_status" ON "task" ("assigneeUserId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_reporter_status" ON "task" ("reporterUserId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_status_updated" ON "task" ("status", "updated_at")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_activity" (
        "id" SERIAL NOT NULL,
        "taskId" integer NOT NULL,
        "actorUserId" integer,
        "kind" character varying NOT NULL,
        "fromValue" character varying,
        "toValue" character varying,
        "body" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_activity" PRIMARY KEY ("id"),
        CONSTRAINT "FK_task_activity_task" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_task_activity_actor" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_activity_task_id" ON "task_activity" ("taskId", "id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "task_activity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task"`);
  }
}
