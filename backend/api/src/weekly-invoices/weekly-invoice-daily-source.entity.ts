import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { DailySubmission } from '../daily-submissions/daily-submission.entity';
import { WeeklyInvoice } from './weekly-invoice.entity';

@Entity('weekly_invoice_daily_source')
@Unique(['weeklyInvoiceId', 'reportingDate'])
export class WeeklyInvoiceDailySource {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WeeklyInvoice, (invoice) => invoice.dailySources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'weeklyInvoiceId' })
  weeklyInvoice: WeeklyInvoice;

  @Column({ type: 'int' })
  weeklyInvoiceId: number;

  @Column({ type: 'date' })
  reportingDate: string;

  @ManyToOne(() => DailySubmission, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'dailySubmissionId' })
  dailySubmission: DailySubmission | null;

  @Column({ type: 'int', nullable: true })
  dailySubmissionId: number | null;

  @Column({ type: 'varchar' })
  status: string;

  @CreateDateColumn()
  created_at: Date;
}
