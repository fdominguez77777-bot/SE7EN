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

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Interview } from '../interviews/interview.entity';
import { User } from '../users/user.entity';
import {
  JobApplicationSource,
  JobApplicationStatus,
} from './job-application.rules';

@Entity('job_application')
@Index(['candidateProfileId'])
@Index(['bidderId'])
@Index(['appliedAt'])
@Index(['status'])
export class JobApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => BidderProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: BidderProfile;

  @Column({ type: 'int', name: 'candidate_profile_id' })
  candidateProfileId: number;

  /** Bidder credited when the application was recorded. Null if that account was deleted. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User | null;

  @Column({ type: 'int', nullable: true })
  bidderId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdByUser: User | null;

  @Column({ type: 'int', name: 'created_by', nullable: true })
  createdByUserId: number | null;

  @Column({ type: 'varchar' })
  companyName: string;

  @Column({ type: 'varchar' })
  jobTitle: string;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', nullable: true })
  jobUrl: string | null;

  @Column({ type: 'varchar', default: JobApplicationSource.TALYN })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  sourceExternalId: string | null;

  @Index({ unique: true, where: '"talynApplicationId" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  talynApplicationId: string | null;

  @Column({ type: 'timestamptz' })
  appliedAt: Date;

  @Column({ type: 'varchar', default: JobApplicationStatus.APPLIED })
  status: string;

  @Column({ type: 'text', nullable: true })
  jobDescriptionText: string | null;

  @Column({ type: 'text', nullable: true })
  resumeText: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => Interview, (interview) => interview.jobApplication)
  interviews: Interview[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
