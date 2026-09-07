import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityEvent } from '../activity/activity-event.entity';
import { AuthModule } from '../auth/auth.module';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Interview } from '../interviews/interview.entity';
import { UnconfiguredTalynApplicationClient } from '../integrations/talyn/talyn-application.client';
import { JobApplication } from './job-application.entity';
import { JobApplicationsController } from './job-applications.controller';
import { JobApplicationsService } from './job-applications.service';
import { TalynSyncService } from './talyn-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobApplication, BidderProfile, ActivityEvent, Interview]),
    AuthModule,
    ConfigModule,
  ],
  controllers: [JobApplicationsController],
  providers: [
    JobApplicationsService,
    TalynSyncService,
    UnconfiguredTalynApplicationClient,
  ],
  exports: [JobApplicationsService, TalynSyncService],
})
export class JobApplicationsModule {}
