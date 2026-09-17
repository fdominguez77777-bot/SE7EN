import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { JiracodersClient } from './jiracoders.client';
import { JiracodersApplicationsController } from './jiracoders.controller';
import { JiracodersApplicationsService } from './jiracoders.service';

@Module({
  imports: [AuthModule, ConfigModule, UsersModule],
  controllers: [JiracodersApplicationsController],
  providers: [JiracodersClient, JiracodersApplicationsService],
  exports: [JiracodersApplicationsService],
})
export class JiracodersModule {}
