import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { WalletStatus } from './wallet.rules';

@Entity('wallet_transaction')
@Index(['ownerUserId', 'occurredOn'])
@Index(['occurredOn', 'id'])
@Index(['status', 'occurredOn'])
@Index(['type', 'occurredOn'])
export class WalletTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  ownerUser: User;

  @Column({ type: 'int' })
  ownerUserId: number;

  @Column({ type: 'date' })
  occurredOn: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  direction: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar' })
  counterparty: string;

  @Column({ type: 'varchar' })
  method: string;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', default: WalletStatus.POSTED })
  status: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @Column({ type: 'int', nullable: true })
  createdByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'voidedByUserId' })
  voidedByUser: User | null;

  @Column({ type: 'int', nullable: true })
  voidedByUserId: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  voidReason: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
