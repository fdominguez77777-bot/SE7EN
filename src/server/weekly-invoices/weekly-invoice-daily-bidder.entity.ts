import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { User } from '../users/user.entity';
import { WeeklyInvoice } from './weekly-invoice.entity';

@Entity('weekly_invoice_daily_bidder')
@Unique(['weeklyInvoiceId', 'bidderId', 'reportingDate'])
export class WeeklyInvoiceDailyBidder {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WeeklyInvoice, (invoice) => invoice.dailyBidders, {
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

  @Column({ type: 'date' })
  reportingDate: string;

  @Column({ type: 'int', nullable: true })
  applicationCount: number | null;

  @Column({ type: 'int', nullable: true })
  interviewCount: number | null;

  @Column({ type: 'boolean', default: false })
  included: boolean;

  @CreateDateColumn()
  created_at: Date;
}
