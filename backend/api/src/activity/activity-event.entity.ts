import {
  Column,
  CreateDateColumn,
  Entity,
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

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ type: 'int', name: 'created_by' })
  createdById: number;

  @CreateDateColumn()
  created_at: Date;
}
