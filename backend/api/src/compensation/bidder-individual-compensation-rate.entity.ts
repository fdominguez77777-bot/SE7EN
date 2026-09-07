import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../users/user.entity';

@Entity('bidder_individual_compensation_rate')
@Index(['bidderId'])
@Index(['bidderId', 'effectiveFrom'])
export class BidderIndividualCompensationRate {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'int' })
  bidderId: number;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  applicationRate: string;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  interviewRate: string;

  @Column({ type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;
}
