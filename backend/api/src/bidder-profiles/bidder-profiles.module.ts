import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BidderProfile } from './bidder-profile.entity';
import { BidderProfilesController } from './bidder-profiles.controller';
import { BidderProfilesService } from './bidder-profiles.service';
import { Education } from './education.entity';
import { WorkExperience } from './work-experience.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BidderProfile, WorkExperience, Education]),
    UsersModule,
    AuthModule,
    AuditModule,
  ],
  controllers: [BidderProfilesController],
  providers: [BidderProfilesService],
  exports: [BidderProfilesService],
})
export class BidderProfilesModule {}
