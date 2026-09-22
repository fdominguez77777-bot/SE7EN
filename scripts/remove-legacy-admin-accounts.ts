import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

import '../src/server/preserve-entity-names';
import { ActivityEvent } from '../src/server/activity/activity-event.entity';
import { AuditEvent } from '../src/server/audit/audit-event.entity';
import { BidInvitation } from '../src/server/bid-invitations/bid-invitation.entity';
import { BidSubmission } from '../src/server/bid-submissions/bid-submission.entity';
import { BidderProfile } from '../src/server/bidder-profiles/bidder-profile.entity';
import { Education } from '../src/server/bidder-profiles/education.entity';
import { WorkExperience } from '../src/server/bidder-profiles/work-experience.entity';
import { CalendarAccount } from '../src/server/calendar/calendar-account.entity';
import { CalendarConnectLink } from '../src/server/calendar/calendar-connect-link.entity';
import { BidManagerCompensation } from '../src/server/compensation/bid-manager-compensation.entity';
import { BidManagerWeeklyPayment } from '../src/server/compensation/bid-manager-weekly-payment.entity';
import { BidderCompensationRate } from '../src/server/compensation/bidder-compensation-rate.entity';
import { BidderIndividualCompensationRate } from '../src/server/compensation/bidder-individual-compensation-rate.entity';
import { BidderWeeklyPayment } from '../src/server/compensation/bidder-weekly-payment.entity';
import { applyDatabaseUrl, isManagedPostgresSsl } from '../src/server/config/database-url';
import { DailySubmission } from '../src/server/daily-submissions/daily-submission.entity';
import { DailySubmissionBidder } from '../src/server/daily-submissions/daily-submission-bidder.entity';
import { DailySubmissionRead } from '../src/server/daily-submissions/daily-submission-read.entity';
import { Interview } from '../src/server/interviews/interview.entity';
import { JobApplication } from '../src/server/job-applications/job-application.entity';
import { Project } from '../src/server/projects/project.entity';
import { detachUserReferences } from '../src/server/users/detach-user-references';
import { UserRole } from '../src/server/users/user-role.enum';
import { User } from '../src/server/users/user.entity';
import { DEFAULT_ADMIN_EMAIL } from '../src/server/users/users.service';
import { WalletTransaction } from '../src/server/wallet/wallet-transaction.entity';
import { WeeklyInvoice } from '../src/server/weekly-invoices/weekly-invoice.entity';
import { WeeklyInvoiceBidder } from '../src/server/weekly-invoices/weekly-invoice-bidder.entity';
import { WeeklyInvoiceDailyBidder } from '../src/server/weekly-invoices/weekly-invoice-daily-bidder.entity';
import { WeeklyInvoiceDailySource } from '../src/server/weekly-invoices/weekly-invoice-daily-source.entity';

config({ path: resolve(process.cwd(), '.env') });

const db = applyDatabaseUrl(process.env as Record<string, unknown>);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isLegacyBootstrapAdmin(user: User) {
  return normalizeEmail(user.email) === normalizeEmail(DEFAULT_ADMIN_EMAIL);
}

function isDuplicateAdminName(user: User) {
  return user.name.trim() === 'Admin';
}

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: String(db.DATABASE_HOST ?? ''),
    port: Number(db.DATABASE_PORT ?? 5432),
    username: String(db.DATABASE_USER ?? ''),
    password: String(db.DATABASE_PASSWORD ?? ''),
    database: String(db.DATABASE_NAME ?? ''),
    ssl: isManagedPostgresSsl(
      process.env.NODE_ENV,
      process.env.DATABASE_URL,
      String(db.DATABASE_HOST ?? ''),
    )
      ? { rejectUnauthorized: false }
      : false,
    entities: [
      ActivityEvent,
      AuditEvent,
      BidInvitation,
      BidSubmission,
      BidderProfile,
      Education,
      WorkExperience,
      CalendarAccount,
      CalendarConnectLink,
      BidManagerCompensation,
      BidManagerWeeklyPayment,
      BidderCompensationRate,
      BidderIndividualCompensationRate,
      BidderWeeklyPayment,
      DailySubmission,
      DailySubmissionBidder,
      DailySubmissionRead,
      Interview,
      JobApplication,
      Project,
      User,
      WeeklyInvoice,
      WeeklyInvoiceBidder,
      WeeklyInvoiceDailyBidder,
      WeeklyInvoiceDailySource,
      WalletTransaction,
    ],
  });

  await dataSource.initialize();
  try {
    const users = await dataSource.getRepository(User).find({
      order: { id: 'ASC' },
    });
    const targets = users.filter(
      (user) => isLegacyBootstrapAdmin(user) || isDuplicateAdminName(user),
    );
    if (targets.length === 0) {
      console.log('No legacy admin accounts to remove.');
      return;
    }

    const targetIds = new Set(targets.map((user) => user.id));
    const remainingAdmins = users.filter(
      (user) =>
        user.role === UserRole.ADMIN &&
        user.isActive !== false &&
        !targetIds.has(user.id),
    );
    if (remainingAdmins.length === 0) {
      throw new Error(
        'Refusing to delete: no other active Admin would remain. Create or enable another Admin first.',
      );
    }

    const actorId = remainingAdmins[0]!.id;
    for (const user of targets) {
      const label = `#${user.id} (${user.name}, ${user.email}, ${user.role})`;
      await dataSource.transaction(async (manager) => {
        await manager.query(`SET LOCAL lock_timeout = '8s'`);
        await manager.query(`SET LOCAL statement_timeout = '25s'`);
        await detachUserReferences(manager, user.id, actorId);
        await manager.remove(user);
      });
      console.log(`Removed user ${label}.`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
