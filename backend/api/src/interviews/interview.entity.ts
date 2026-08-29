import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { User } from '../users/user.entity';

@Entity('interview')
export class Interview {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BidderProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: BidderProfile;

  @Column({ type: 'int', name: 'candidate_profile_id' })
  candidateProfileId: number;

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
