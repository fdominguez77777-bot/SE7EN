import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  EnvironmentVariables,
  validateEnvironment,
} from './config/env.validation';
import { isManagedPostgresSsl } from './config/database-url';
import { ActivityModule } from './activity/activity.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { StorageModule } from './storage/storage.module';
import { BidInvitationsModule } from './bid-invitations/bid-invitations.module';
import { BidSubmissionsModule } from './bid-submissions/bid-submissions.module';
import { BidderProfilesModule } from './bidder-profiles/bidder-profiles.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InterviewsModule } from './interviews/interviews.module';
import { JobApplicationsModule } from './job-applications/job-applications.module';
import { TalynIngestModule } from './integrations/talyn/talyn.module';
import { JiracodersModule } from './integrations/jiracoders/jiracoders.module';
import { CalendarModule } from './calendar/calendar.module';
import { CompensationModule } from './compensation/compensation.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersModule } from './users/users.module';
import { DailySubmissionsModule } from './daily-submissions/daily-submissions.module';
import { WeeklyInvoicesModule } from './weekly-invoices/weekly-invoices.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        return {
          type: 'postgres' as const,
          host: config.get('DATABASE_HOST', { infer: true }),
          port: config.get('DATABASE_PORT', { infer: true }),
          username: config.get('DATABASE_USER', { infer: true }),
          password: config.get('DATABASE_PASSWORD', { infer: true }),
          database: config.get('DATABASE_NAME', { infer: true }),
          autoLoadEntities: true,
          synchronize: config.get('DB_SYNCHRONIZE', { infer: true }),
          ssl: isManagedPostgresSsl(nodeEnv)
            ? { rejectUnauthorized: false }
            : false,
        };
      },
    }),
    HealthModule,
    StorageModule,
    AuditModule,
    UsersModule,
    DailySubmissionsModule,
    WeeklyInvoicesModule,
    AuthModule,
    BidderProfilesModule,
    ProjectsModule,
    BidInvitationsModule,
    BidSubmissionsModule,
    ActivityModule,
    InterviewsModule,
    JobApplicationsModule,
    TalynIngestModule,
    JiracodersModule,
    CalendarModule,
    CompensationModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
