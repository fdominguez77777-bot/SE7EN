import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarModule } from '../calendar/calendar.module';
import { JiracodersModule } from '../integrations/jiracoders/jiracoders.module';
import { Interview } from '../interviews/interview.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { User } from '../users/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, JobApplication, Interview]),
    ActivityModule,
    AuthModule,
    JiracodersModule,
    CalendarModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
