import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityEvent } from '../activity/activity-event.entity';
import { AuthModule } from '../auth/auth.module';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Interview } from '../interviews/interview.entity';
import { User } from '../users/user.entity';
import { DailySubmissionBidder } from './daily-submission-bidder.entity';
import { DailySubmissionRead } from './daily-submission-read.entity';
import { DailySubmission } from './daily-submission.entity';
import { DailySubmissionsController } from './daily-submissions.controller';
import { DailySubmissionsService } from './daily-submissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailySubmission,
      DailySubmissionBidder,
      DailySubmissionRead,
      User,
      BidderProfile,
      ActivityEvent,
      Interview,
    ]),
    AuthModule,
  ],
  controllers: [DailySubmissionsController],
  providers: [DailySubmissionsService],
  exports: [DailySubmissionsService],
})
export class DailySubmissionsModule {}
