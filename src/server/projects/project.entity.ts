import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { ProjectStatus } from './project-status.enum';

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: ProjectStatus.DRAFT })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  opensAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closesAt: Date | null;

  @Column({ type: 'int', name: 'awarded_submission_id', nullable: true })
  awardedSubmissionId: number | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ type: 'int', name: 'created_by' })
  createdById: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
