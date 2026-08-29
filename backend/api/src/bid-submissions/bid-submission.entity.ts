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

import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { SubmissionStatus } from './submission-status.enum';

@Entity()
@Index(['projectId', 'bidderProfileId'], { unique: true })
export class BidSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'int', name: 'project_id' })
  projectId: number;

  @ManyToOne(() => BidderProfile, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bidder_profile_id' })
  bidderProfile: BidderProfile;

  @Column({ type: 'int', name: 'bidder_profile_id' })
  bidderProfileId: number;

  @ManyToOne(() => BidInvitation, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitation_id' })
  invitation: BidInvitation;

  @Column({ type: 'int', name: 'invitation_id' })
  invitationId: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', default: SubmissionStatus.SUBMITTED })
  status: string;

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
