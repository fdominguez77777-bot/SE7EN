import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { ActivityController } from './activity.controller';
import { ActivityEvent } from './activity-event.entity';
import { ActivityService } from './activity.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityEvent, BidderProfile]),
    AuthModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
