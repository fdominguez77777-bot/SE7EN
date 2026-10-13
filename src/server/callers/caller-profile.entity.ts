import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** A bidder profile whose schedules and applications one CALLER may see. */
@Entity({ name: 'caller_profile' })
export class CallerProfile {
  @PrimaryColumn({ type: 'int' })
  callerId: number;

  @Index()
  @PrimaryColumn({ type: 'int' })
  profileId: number;

  @Column({ type: 'int', nullable: true })
  assignedById: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  assignedAt: Date;
}
