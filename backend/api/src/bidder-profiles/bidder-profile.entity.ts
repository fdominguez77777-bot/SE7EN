import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { BidderProfileStatus } from './bidder-profile-status.enum';
import { Education } from './education.entity';
import { WorkExperience } from './work-experience.entity';

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

  @OneToMany(() => WorkExperience, (row) => row.candidateProfile)
  experiences: WorkExperience[];

  @OneToMany(() => Education, (row) => row.candidateProfile)
  educations: Education[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
