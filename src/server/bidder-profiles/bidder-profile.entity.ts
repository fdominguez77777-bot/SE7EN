import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { User } from '../users/user.entity';
import * as userEntity from '../users/user.entity';
import { BidderProfileStatus } from './bidder-profile-status.enum';
import type { Education } from './education.entity';
import * as educationEntity from './education.entity';
import type { WorkExperience } from './work-experience.entity';
import * as workExperienceEntity from './work-experience.entity';

@Entity()
export class BidderProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  legalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  middleName: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  streetAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  stateRegion: string | null;

  @Column({ type: 'varchar', nullable: true })
  zipPostalCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkedinUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  githubUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  portfolioUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  raceEthnicity: string | null;

  @Column({ type: 'varchar', nullable: true })
  veteranStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  disabilityStatus: string | null;

  @Column({ type: 'varchar', default: BidderProfileStatus.ACTIVE })
  status: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  assignedBidderId: number | null;

  @ManyToOne(() => userEntity.User, (user) => user.assignedCandidateProfiles, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assignedBidderId' })
  assignedBidder: User | null;

  @OneToMany(
    () => workExperienceEntity.WorkExperience,
    (experience) => experience.candidateProfile,
  )
  experiences: WorkExperience[];

  @OneToMany(
    () => educationEntity.Education,
    (education) => education.candidateProfile,
  )
  educations: Education[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
