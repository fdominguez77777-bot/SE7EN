import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

import { UserRole } from './user-role.enum';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'varchar', default: UserRole.BIDDER })
  role: string;

  @Column({ type: 'int', nullable: true })
  bidderProfileId: number | null;

  @CreateDateColumn()
  created_at: Date;
}
