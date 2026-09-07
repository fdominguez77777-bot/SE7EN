import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { UserRole } from './user-role.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', select: false })
  password: string;

  @Column({ type: 'varchar', default: UserRole.BIDDER })
  role: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', nullable: true })
  avatarPath: string | null;

  /**
   * @deprecated Legacy 1:1 user→profile column. Not written by application code.
   * Assignment, authorization, applications, interviews, activity, reports,
   * and compensation use BidderProfile.assignedBidderId and historical
   * ActivityEvent/JobApplication/Interview.bidderId snapshots.
   * Kept only for backward-compatible migrations. Do not use for business logic.
   */
  @Column({ type: 'int', nullable: true })
  bidderProfileId: number | null;

  @OneToMany(() => BidderProfile, (profile) => profile.assignedBidder)
  assignedCandidateProfiles: BidderProfile[];

  @CreateDateColumn()
  created_at: Date;
}
