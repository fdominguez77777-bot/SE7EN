import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { PaymentStatus } from './compensation.rules';

@Entity('bidder_weekly_payment')
@Unique(['bidderId', 'periodStart', 'periodEnd'])
export class BidderWeeklyPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'int' })
  bidderId: number;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'int' })
  applicationCount: number;

  @Column({ type: 'int' })
  interviewCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  applicationRate: string;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  interviewRate: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  applicationPayAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  interviewPayAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ type: 'varchar', default: PaymentStatus.DRAFT })
  status: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User | null;

  @Column({ type: 'int', nullable: true })
  reviewedByUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paidByUserId' })
  paidByUser: User | null;

  @Column({ type: 'int', nullable: true })
  paidByUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
