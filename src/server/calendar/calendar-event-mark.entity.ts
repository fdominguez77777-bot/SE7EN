import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Saved interview type for one synced calendar event. */
@Entity({ name: 'calendar_event_mark' })
export class CalendarEventMark {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_calendar_event_mark_eventKey', { unique: true })
  @Column({ type: 'varchar', length: 1024 })
  eventKey: string;

  @Column({ type: 'varchar', length: 16 })
  kind: string;

  @Column({ type: 'int', nullable: true })
  updatedById: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
