import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { BidderCompensationRate } from '../compensation/bidder-compensation-rate.entity';
import { BidderIndividualCompensationRate } from '../compensation/bidder-individual-compensation-rate.entity';
import { DailySubmission } from '../daily-submissions/daily-submission.entity';
import { User } from '../users/user.entity';
import { WeeklyInvoiceBidder } from './weekly-invoice-bidder.entity';
import { WeeklyInvoiceDailyBidder } from './weekly-invoice-daily-bidder.entity';
import { WeeklyInvoiceDailySource } from './weekly-invoice-daily-source.entity';
import { WeeklyInvoice } from './weekly-invoice.entity';
import { WeeklyInvoicesController } from './weekly-invoices.controller';
import { WeeklyInvoicesService } from './weekly-invoices.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeeklyInvoice,
      WeeklyInvoiceBidder,
      WeeklyInvoiceDailySource,
      WeeklyInvoiceDailyBidder,
      DailySubmission,
      User,
      BidderProfile,
      BidderCompensationRate,
      BidderIndividualCompensationRate,
    ]),
    AuthModule,
  ],
  controllers: [WeeklyInvoicesController],
  providers: [WeeklyInvoicesService],
  exports: [WeeklyInvoicesService],
})
export class WeeklyInvoicesModule {}
