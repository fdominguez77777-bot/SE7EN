import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { Task } from './task.entity';

@Entity('task_activity')
@Index(['taskId', 'id'])
export class TaskActivity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ type: 'int' })
  taskId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorUserId' })
  actor: User | null;

  @Column({ type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ type: 'varchar' })
  kind: string;

  @Column({ type: 'varchar', nullable: true })
  fromValue: string | null;

  @Column({ type: 'varchar', nullable: true })
  toValue: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @CreateDateColumn()
  created_at: Date;
}
