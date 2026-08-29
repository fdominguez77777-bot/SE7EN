import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BidderProfile } from './bidder-profile.entity';

@Entity('work_experience')
export class WorkExperience {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BidderProfile, (profile) => profile.experiences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: BidderProfile;

  @Column({ type: 'int', name: 'candidate_profile_id' })
  candidateProfileId: number;

  @Column({ type: 'varchar' })
  companyName: string;

  @Column({ type: 'varchar', nullable: true })
  industry: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  state: string | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'boolean', default: false })
  currentlyWorksHere: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
