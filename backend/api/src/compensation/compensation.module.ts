import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { Interview } from '../interviews/interview.entity';
import { UsersModule } from '../users/users.module';
import { BidManagerCompensation } from './bid-manager-compensation.entity';
import { BidManagerWeeklyPayment } from './bid-manager-weekly-payment.entity';
import { BidderCompensationRate } from './bidder-compensation-rate.entity';
import { BidderIndividualCompensationRate } from './bidder-individual-compensation-rate.entity';
import { BidderWeeklyPayment } from './bidder-weekly-payment.entity';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BidderCompensationRate,
      BidderIndividualCompensationRate,
      BidManagerCompensation,
      BidderWeeklyPayment,
      BidManagerWeeklyPayment,
      Interview,
    ]),
    AuthModule,
    ActivityModule,
    UsersModule,
  ],
  controllers: [CompensationController],
  providers: [CompensationService],
  exports: [CompensationService],
})
export class CompensationModule {}
