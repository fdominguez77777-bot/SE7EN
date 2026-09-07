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

@Entity('bid_manager_weekly_payment')
@Unique(['managerId', 'periodStart', 'periodEnd'])
export class BidManagerWeeklyPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'managerId' })
  manager: User;

  @Column({ type: 'int' })
  managerId: number;

  @Column({ type: 'timestamptz' })
  periodStart: Date;

  @Column({ type: 'timestamptz' })
  periodEnd: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  weeklySalaryRate: string;

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
