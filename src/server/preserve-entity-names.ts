import { ActivityEvent } from './activity/activity-event.entity'
import { AuditEvent } from './audit/audit-event.entity'
import { BidInvitation } from './bid-invitations/bid-invitation.entity'
import { BidSubmission } from './bid-submissions/bid-submission.entity'
import { BidderProfile } from './bidder-profiles/bidder-profile.entity'
import { Education } from './bidder-profiles/education.entity'
import { WorkExperience } from './bidder-profiles/work-experience.entity'
import { CalendarAccount } from './calendar/calendar-account.entity'
import { CalendarConnectLink } from './calendar/calendar-connect-link.entity'
import { BidManagerCompensation } from './compensation/bid-manager-compensation.entity'
import { BidManagerWeeklyPayment } from './compensation/bid-manager-weekly-payment.entity'
import { BidderCompensationRate } from './compensation/bidder-compensation-rate.entity'
import { BidderIndividualCompensationRate } from './compensation/bidder-individual-compensation-rate.entity'
import { BidderWeeklyPayment } from './compensation/bidder-weekly-payment.entity'
import { DailySubmissionBidder } from './daily-submissions/daily-submission-bidder.entity'
import { DailySubmissionRead } from './daily-submissions/daily-submission-read.entity'
import { DailySubmission } from './daily-submissions/daily-submission.entity'
import { Interview } from './interviews/interview.entity'
import { JobApplication } from './job-applications/job-application.entity'
import { Project } from './projects/project.entity'
import { User } from './users/user.entity'
import { WeeklyInvoiceBidder } from './weekly-invoices/weekly-invoice-bidder.entity'
import { WeeklyInvoiceDailyBidder } from './weekly-invoices/weekly-invoice-daily-bidder.entity'
import { WeeklyInvoiceDailySource } from './weekly-invoices/weekly-invoice-daily-source.entity'
import { WeeklyInvoice } from './weekly-invoices/weekly-invoice.entity'
import { WalletTransaction } from './wallet/wallet-transaction.entity'
import { LoginHistory } from './login-history/login-history.entity'

/**
 * TypeORM uses `constructor.name` as the entity graph id. Vercel minifies
 * many classes to the same letter, which shows up as CircularRelationsError
 * `j -> j`. Restore stable names before DataSource.initialize().
 */
function freezeName(ctor: Function, name: string) {
  Object.defineProperty(ctor, 'name', { value: name, configurable: true })
}

freezeName(ActivityEvent, 'ActivityEvent')
freezeName(AuditEvent, 'AuditEvent')
freezeName(BidInvitation, 'BidInvitation')
freezeName(BidSubmission, 'BidSubmission')
freezeName(BidderProfile, 'BidderProfile')
freezeName(Education, 'Education')
freezeName(WorkExperience, 'WorkExperience')
freezeName(CalendarAccount, 'CalendarAccount')
freezeName(CalendarConnectLink, 'CalendarConnectLink')
freezeName(BidManagerCompensation, 'BidManagerCompensation')
freezeName(BidManagerWeeklyPayment, 'BidManagerWeeklyPayment')
freezeName(BidderCompensationRate, 'BidderCompensationRate')
freezeName(BidderIndividualCompensationRate, 'BidderIndividualCompensationRate')
freezeName(BidderWeeklyPayment, 'BidderWeeklyPayment')
freezeName(DailySubmission, 'DailySubmission')
freezeName(DailySubmissionBidder, 'DailySubmissionBidder')
freezeName(DailySubmissionRead, 'DailySubmissionRead')
freezeName(Interview, 'Interview')
freezeName(JobApplication, 'JobApplication')
freezeName(Project, 'Project')
freezeName(User, 'User')
freezeName(WeeklyInvoice, 'WeeklyInvoice')
freezeName(WeeklyInvoiceBidder, 'WeeklyInvoiceBidder')
freezeName(WeeklyInvoiceDailyBidder, 'WeeklyInvoiceDailyBidder')
freezeName(WeeklyInvoiceDailySource, 'WeeklyInvoiceDailySource')
freezeName(WalletTransaction, 'WalletTransaction')
freezeName(LoginHistory, 'LoginHistory')
