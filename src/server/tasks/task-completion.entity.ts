import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { User } from '../users/user.entity';
import { Task } from './task.entity';

/** One assignee finishing their part of a task on one day. */
@Entity('task_completion')
@Index(['occursOn'])
export class TaskCompletion {
  @PrimaryColumn({ type: 'int' })
  taskId: number;

  @PrimaryColumn({ type: 'date' })
  occursOn: string;

  @PrimaryColumn({ type: 'int' })
  completedByUserId: number;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'completedByUserId' })
  completedBy: User;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  completedAt: Date;
}
