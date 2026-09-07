import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { DailySubmission } from './daily-submission.entity';

@Entity('daily_submission_bidder')
@Unique(['dailySubmissionId', 'bidderId'])
export class DailySubmissionBidder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => DailySubmission, (submission) => submission.rows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dailySubmissionId' })
  dailySubmission: DailySubmission;

  @Column({ type: 'int' })
  dailySubmissionId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'int' })
  bidderId: number;

  @Column({ type: 'int', default: 0 })
  systemApplicationCount: number;

  @Column({ type: 'int', nullable: true })
  gmailConfirmedApplicationCount: number | null;

  @Column({ type: 'int', default: 0 })
  systemInterviewCount: number;

  @Column({ type: 'int', nullable: true })
  verifiedInterviewCount: number | null;

  @Column({ type: 'int', nullable: true })
  applicationDifference: number | null;

  @Column({ type: 'int', nullable: true })
  interviewDifference: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
