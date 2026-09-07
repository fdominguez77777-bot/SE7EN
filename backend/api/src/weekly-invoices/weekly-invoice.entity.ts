import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { WeeklyInvoiceStatus } from './weekly-invoice.rules';
import { WeeklyInvoiceBidder } from './weekly-invoice-bidder.entity';
import { WeeklyInvoiceDailyBidder } from './weekly-invoice-daily-bidder.entity';
import { WeeklyInvoiceDailySource } from './weekly-invoice-daily-source.entity';

@Entity('weekly_invoice')
@Unique(['managerId', 'periodStart', 'periodEnd'])
@Index(['periodStart'])
@Index(['status'])
export class WeeklyInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'managerId' })
  manager: User;

  @Column({ type: 'int' })
  managerId: number;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({ type: 'varchar', default: WeeklyInvoiceStatus.DRAFT })
  status: string;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewedByUserId' })
  reviewedByUser: User | null;

  @Column({ type: 'int', nullable: true })
  reviewedByUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedByUserId' })
  approvedByUser: User | null;

  @Column({ type: 'int', nullable: true })
  approvedByUserId: number | null;

  @Column({ type: 'text', nullable: true })
  managerNotes: string | null;

  @Column({ type: 'jsonb', default: [] })
  noActivityDates: string[];

  @Column({ type: 'text', nullable: true })
  missingDayAcknowledgement: string | null;

  @OneToMany(() => WeeklyInvoiceBidder, (row) => row.weeklyInvoice, {
    cascade: true,
  })
  rows: WeeklyInvoiceBidder[];

  @OneToMany(() => WeeklyInvoiceDailySource, (row) => row.weeklyInvoice, {
    cascade: true,
  })
  dailySources: WeeklyInvoiceDailySource[];

  @OneToMany(() => WeeklyInvoiceDailyBidder, (row) => row.weeklyInvoice, {
    cascade: true,
  })
  dailyBidders: WeeklyInvoiceDailyBidder[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
