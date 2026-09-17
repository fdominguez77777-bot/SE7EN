import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { User } from '../users/user.entity';
import { InterviewStatus } from './interview.rules';

@Entity('interview')
@Index(['jobApplicationId'])
@Index(['status'])
@Index(['startsAt'])
@Index(['bidderId'])
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BidderProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: BidderProfile;

  @Column({ type: 'int', name: 'candidate_profile_id' })
  candidateProfileId: number;

  @ManyToOne(() => JobApplication, (application) => application.interviews, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'jobApplicationId' })
  jobApplication: JobApplication | null;

  @Column({ type: 'int', nullable: true })
  jobApplicationId: number | null;

  /** Bidder credited when the interview was recorded. Does not follow reassignment. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User | null;

  @Column({ type: 'int', nullable: true })
  bidderId: number | null;

  @Column({ type: 'varchar' })
  company: string;

  @Column({ type: 'varchar' })
  jobTitle: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'varchar', nullable: true })
  round: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'varchar', default: InterviewStatus.SCHEDULED })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  method: string | null;

  @Column({ type: 'varchar', nullable: true })
  result: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

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
