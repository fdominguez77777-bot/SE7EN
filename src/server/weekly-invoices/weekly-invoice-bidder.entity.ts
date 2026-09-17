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
import { WeeklyInvoice } from './weekly-invoice.entity';

@Entity('weekly_invoice_bidder')
@Unique(['weeklyInvoiceId', 'bidderId'])
export class WeeklyInvoiceBidder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WeeklyInvoice, (invoice) => invoice.rows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'weeklyInvoiceId' })
  weeklyInvoice: WeeklyInvoice;

  @Column({ type: 'int' })
  weeklyInvoiceId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'bidderId' })
  bidder: User;

  @Column({ type: 'int' })
  bidderId: number;

  @Column({ type: 'int', default: 0 })
  defaultApplicationCount: number;

  @Column({ type: 'int', default: 0 })
  invoiceApplicationCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  configuredApplicationRate: string;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  invoiceApplicationRate: string;

  @Column({ type: 'int', default: 0 })
  defaultInterviewCount: number;

  @Column({ type: 'int', default: 0 })
  invoiceInterviewCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  configuredInterviewRate: string;

  @Column({ type: 'numeric', precision: 10, scale: 4 })
  invoiceInterviewRate: string;

  @Column({ type: 'int', default: 0 })
  applicationDifference: number;

  @Column({ type: 'int', default: 0 })
  interviewDifference: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0.00' })
  applicationAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0.00' })
  interviewAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: '0.00' })
  totalAmount: string;

  @Column({ type: 'varchar', default: 'default' })
  rateSource: string;

  @Column({ type: 'text', nullable: true })
  countAdjustmentReason: string | null;

  @Column({ type: 'text', nullable: true })
  rateAdjustmentReason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
