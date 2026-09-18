import { EntityManager } from 'typeorm';

import { ActivityEvent } from '../activity/activity-event.entity';
import { AuditEvent } from '../audit/audit-event.entity';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { BidSubmission } from '../bid-submissions/bid-submission.entity';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { CalendarAccount } from '../calendar/calendar-account.entity';
import { CalendarConnectLink } from '../calendar/calendar-connect-link.entity';
import { BidManagerCompensation } from '../compensation/bid-manager-compensation.entity';
import { BidManagerWeeklyPayment } from '../compensation/bid-manager-weekly-payment.entity';
import { BidderCompensationRate } from '../compensation/bidder-compensation-rate.entity';
import { BidderIndividualCompensationRate } from '../compensation/bidder-individual-compensation-rate.entity';
import { BidderWeeklyPayment } from '../compensation/bidder-weekly-payment.entity';
import { DailySubmission } from '../daily-submissions/daily-submission.entity';
import { DailySubmissionBidder } from '../daily-submissions/daily-submission-bidder.entity';
import { DailySubmissionRead } from '../daily-submissions/daily-submission-read.entity';
import { Interview } from '../interviews/interview.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { Project } from '../projects/project.entity';
import { WeeklyInvoice } from '../weekly-invoices/weekly-invoice.entity';
import { WeeklyInvoiceBidder } from '../weekly-invoices/weekly-invoice-bidder.entity';
import { WeeklyInvoiceDailyBidder } from '../weekly-invoices/weekly-invoice-daily-bidder.entity';
import { WalletTransaction } from '../wallet/wallet-transaction.entity';

const TRANSIENT_DB_MESSAGE =
  /terminat|ECONNRESET|ECONNREFUSED|connection timed out|timeout expired|canceling statement|lock timeout|deadlock detected/i;

export function isTransientDbError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${error.name}`
      : typeof error === 'string'
        ? error
        : '';
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : error &&
          typeof error === 'object' &&
          'driverError' in error &&
          (error as { driverError?: { code?: unknown } }).driverError
        ? String((error as { driverError?: { code?: unknown } }).driverError?.code)
        : '';
  return (
    TRANSIENT_DB_MESSAGE.test(message) ||
    ['57P01', '57P02', '57P03', '08006', '08001', '08003', '40001', '40P01', '55P03', '57014'].includes(
      code,
    )
  );
}

/** Clear every user FK so `user` can be removed without RESTRICT failures. */
export async function detachUserReferences(
  manager: EntityManager,
  userId: number,
  actorId: number,
): Promise<void> {
  await manager.update(
    BidderProfile,
    { assignedBidderId: userId },
    { assignedBidderId: null },
  );
  await manager.update(JobApplication, { bidderId: userId }, { bidderId: null });
  await manager.update(
    JobApplication,
    { createdByUserId: userId },
    { createdByUserId: null },
  );
  await manager.update(Interview, { bidderId: userId }, { bidderId: null });
  await manager.update(Interview, { createdById: userId }, { createdById: actorId });
  await manager.update(ActivityEvent, { bidderId: userId }, { bidderId: null });
  await manager.update(ActivityEvent, { createdById: userId }, { createdById: null });
  await manager.update(Project, { createdById: userId }, { createdById: actorId });
  await manager.update(BidInvitation, { invitedById: userId }, { invitedById: actorId });
  await manager.update(BidSubmission, { createdById: userId }, { createdById: actorId });
  await manager.update(
    CalendarAccount,
    { assignedBidderId: userId },
    { assignedBidderId: null },
  );
  await manager.update(
    CalendarConnectLink,
    { assignedBidderId: userId },
    { assignedBidderId: null },
  );
  await manager.update(
    CalendarConnectLink,
    { createdById: userId },
    { createdById: actorId },
  );
  await manager.update(AuditEvent, { actorId: userId }, { actorId: null });
  await manager.update(
    BidderCompensationRate,
    { createdByUserId: userId },
    { createdByUserId: null },
  );
  await manager.update(
    BidderIndividualCompensationRate,
    { createdByUserId: userId },
    { createdByUserId: null },
  );
  await manager.update(
    BidManagerCompensation,
    { createdByUserId: userId },
    { createdByUserId: null },
  );
  await manager.update(
    DailySubmission,
    { reviewedByUserId: userId },
    { reviewedByUserId: null },
  );
  await manager.update(
    WeeklyInvoice,
    { reviewedByUserId: userId },
    { reviewedByUserId: null },
  );
  await manager.update(
    WeeklyInvoice,
    { approvedByUserId: userId },
    { approvedByUserId: null },
  );
  await manager.update(
    BidderWeeklyPayment,
    { reviewedByUserId: userId },
    { reviewedByUserId: null },
  );
  await manager.update(
    BidderWeeklyPayment,
    { paidByUserId: userId },
    { paidByUserId: null },
  );
  await manager.update(
    BidManagerWeeklyPayment,
    { reviewedByUserId: userId },
    { reviewedByUserId: null },
  );
  await manager.update(
    BidManagerWeeklyPayment,
    { paidByUserId: userId },
    { paidByUserId: null },
  );
  await manager.delete(WalletTransaction, { ownerUserId: userId });
  await manager.update(
    WalletTransaction,
    { createdByUserId: userId },
    { createdByUserId: null },
  );
  await manager.update(
    WalletTransaction,
    { voidedByUserId: userId },
    { voidedByUserId: null },
  );

  await manager.delete(DailySubmissionRead, { userId });
  await manager.delete(DailySubmissionBidder, { bidderId: userId });
  await manager.delete(WeeklyInvoiceBidder, { bidderId: userId });
  await manager.delete(WeeklyInvoiceDailyBidder, { bidderId: userId });
  await manager.delete(BidderIndividualCompensationRate, { bidderId: userId });
  await manager.delete(BidderWeeklyPayment, { bidderId: userId });

  await manager.query(
    `UPDATE daily_submission AS ds
     SET "managerId" = $1
     WHERE ds."managerId" = $2
       AND NOT EXISTS (
         SELECT 1 FROM daily_submission other
         WHERE other."managerId" = $1
           AND other."reportingDate" = ds."reportingDate"
       )`,
    [actorId, userId],
  );
  await manager.delete(DailySubmission, { managerId: userId });

  await manager.query(
    `UPDATE weekly_invoice AS wi
     SET "managerId" = $1
     WHERE wi."managerId" = $2
       AND NOT EXISTS (
         SELECT 1 FROM weekly_invoice other
         WHERE other."managerId" = $1
           AND other."periodStart" = wi."periodStart"
           AND other."periodEnd" = wi."periodEnd"
       )`,
    [actorId, userId],
  );
  await manager.delete(WeeklyInvoice, { managerId: userId });
}
