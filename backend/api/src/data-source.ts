import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

import { PhaseAJobOps1769800000000 } from './migrations/1769800000000-PhaseAJobOps';
import { Phase4Procurement1767129600000 } from './migrations/1767129600000-Phase4Procurement';

config({ path: resolve(process.cwd(), '.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  migrations: [Phase4Procurement1767129600000, PhaseAJobOps1769800000000],
  migrationsTableName: 'migrations',
});
