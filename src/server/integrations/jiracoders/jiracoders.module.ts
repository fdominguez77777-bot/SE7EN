import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../../auth/auth.module';
import { BidderProfile } from '../../bidder-profiles/bidder-profile.entity';
import { CallersModule } from '../../callers/callers.module';
import { UsersModule } from '../../users/users.module';
import { JiracodersClient } from './jiracoders.client';
import { JiracodersApplicationsController } from './jiracoders.controller';
import { JiracodersApplicationsService } from './jiracoders.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    UsersModule,
    CallersModule,
    TypeOrmModule.forFeature([BidderProfile]),
  ],
  controllers: [JiracodersApplicationsController],
  providers: [JiracodersClient, JiracodersApplicationsService],
  exports: [JiracodersApplicationsService],
})
export class JiracodersModule {}
