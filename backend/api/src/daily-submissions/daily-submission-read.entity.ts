import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { DailySubmission } from './daily-submission.entity';

@Entity('daily_submission_read')
@Unique(['userId', 'dailySubmissionId'])
export class DailySubmissionRead {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => DailySubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dailySubmissionId' })
  dailySubmission: DailySubmission;

  @Column({ type: 'int' })
  dailySubmissionId: number;

  @Column({ type: 'timestamptz' })
  readAt: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
