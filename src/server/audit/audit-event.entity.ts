import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class AuditEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  entityType: string;

  @Column({ type: 'int' })
  entityId: number;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'int', nullable: true })
  actorId: number | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;
}
