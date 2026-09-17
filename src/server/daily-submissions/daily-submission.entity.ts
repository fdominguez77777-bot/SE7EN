import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { DailySubmissionStatus } from './daily-submission.rules';
import { DailySubmissionBidder } from './daily-submission-bidder.entity';

@Entity('daily_submission')
@Unique(['managerId', 'reportingDate'])
@Index(['reportingDate'])
@Index(['status'])
export class DailySubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  reportingDate: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'managerId' })
  manager: User;

  @Column({ type: 'int' })
  managerId: number;

  @Column({ type: 'varchar', default: DailySubmissionStatus.DRAFT })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User | null;

  @Column({ type: 'int', nullable: true })
  reviewedByUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  contentChangedAt: Date | null;

  @OneToMany(() => DailySubmissionBidder, (row) => row.dailySubmission, {
    cascade: true,
  })
  rows: DailySubmissionBidder[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
