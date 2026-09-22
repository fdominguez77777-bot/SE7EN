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

@Entity('login_history')
export class LoginHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Snapshot of the sign-in username at login time. */
  @Column({ type: 'varchar', length: 120 })
  username: string;

  /** Snapshot of display name at login time. */
  @Column({ type: 'varchar', length: 160 })
  displayName: string;

  @Column({ type: 'varchar', length: 40 })
  role: string;

  @Column({ type: 'varchar', length: 64 })
  ipAddress: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  device: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  os: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
