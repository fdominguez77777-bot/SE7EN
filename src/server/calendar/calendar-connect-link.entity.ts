import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'calendar_connect_link' })
export class CalendarConnectLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', unique: true })
  tokenHash: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'int' })
  createdById: number;

  @Column({ type: 'int', nullable: true })
  assignedBidderId: number | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
