import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { User } from '../users/user.entity';
import { Task } from './task.entity';

@Entity('task_completion')
@Index(['occursOn'])
export class TaskCompletion {
  @PrimaryColumn({ type: 'int' })
  taskId: number;

  @PrimaryColumn({ type: 'date' })
  occursOn: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'completedByUserId' })
  completedBy: User | null;

  @Column({ type: 'int', nullable: true })
  completedByUserId: number | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  completedAt: Date;
}
