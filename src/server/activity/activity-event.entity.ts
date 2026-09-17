import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { User } from '../users/user.entity';

export const ActivityType = {
  RESUME: 'RESUME',
  APPLICATION: 'APPLICATION',
  INTERVIEW: 'INTERVIEW',
} as const;

export const ActivitySource = {
  MANUAL: 'MANUAL',
} as const;

@Entity('activity_event')
export class ActivityEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BidderProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: BidderProfile;

  @Column({ type: 'int', name: 'candidate_profile_id' })
  candidateProfileId: number;

  /** BIDDER responsible when this event was recorded. Does not follow later reassignment. */
  @Index()
  @Column({ type: 'int', nullable: true })
  bidderId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User | null;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'varchar', default: ActivitySource.MANUAL })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdById: number | null;

  @Index()
  @Column({ type: 'int', nullable: true })
  jobApplicationId: number | null;

  @CreateDateColumn()
  created_at: Date;
}
