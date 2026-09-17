import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { BidderProfile } from './bidder-profile.entity';

@Entity('education')
export class Education {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BidderProfile, (profile) => profile.educations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: BidderProfile;

  @Column({ type: 'int', name: 'candidate_profile_id' })
  candidateProfileId: number;

  @Column({ type: 'varchar' })
  institutionName: string;

  @Column({ type: 'varchar', nullable: true })
  degree: string | null;

  @Column({ type: 'date', nullable: true })
  fromDate: string | null;

  @Column({ type: 'date', nullable: true })
  toDate: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
