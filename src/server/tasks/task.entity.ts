import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';

@Entity('task')
@Index(['reporterUserId', 'status'])
@Index(['status', 'updated_at'])
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: 'TODO' })
  status: string;

  @Column({ type: 'varchar', default: 'MEDIUM' })
  priority: string;

  @Column({ type: 'varchar', default: 'TASK' })
  type: string;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'varchar', default: 'NONE' })
  repeat: string;

  @Column({ type: 'smallint', nullable: true })
  repeatDays: number | null;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporterUserId' })
  reporter: User | null;

  @Column({ type: 'int', nullable: true })
  reporterUserId: number | null;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'task_assignee',
    joinColumn: { name: 'taskId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  assignees: User[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
