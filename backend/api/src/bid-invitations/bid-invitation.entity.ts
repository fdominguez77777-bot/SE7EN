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
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { InvitationStatus } from './invitation-status.enum';

@Entity()
@Index(['projectId', 'bidderProfileId'], { unique: true })
export class BidInvitation {
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

  @Column({ type: 'varchar', default: InvitationStatus.INVITED })
  status: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'invited_by' })
  invitedBy: User;

  @Column({ type: 'int', name: 'invited_by' })
  invitedById: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
