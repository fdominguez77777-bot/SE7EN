import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
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
import { WalletModule } from './wallet/wallet.module';
import { LoginHistoryModule } from './login-history/login-history.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { DailySubmissionsModule } from './daily-submissions/daily-submissions.module';
import { TransientDbFilter } from './database/transient-db.filter';
import { TransientDbRetryInterceptor } from './database/transient-db.interceptor';
import { WeeklyInvoicesModule } from './weekly-invoices/weekly-invoices.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
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
          retryAttempts: 1,
          retryDelay: 1000,
          ssl: isManagedPostgresSsl(
            nodeEnv,
            config.get('DATABASE_URL', { infer: true }),
            config.get('DATABASE_HOST', { infer: true }),
          )
            ? { rejectUnauthorized: false }
            : false,
          extra: process.env.VERCEL
            ? { max: 1, connectionTimeoutMillis: 8_000 }
            : {
                max: 8,
                connectionTimeoutMillis: 8_000,
                idleTimeoutMillis: 20_000,
                keepAlive: true,
                keepAliveInitialDelayMillis: 10_000,
              },
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
    LoginHistoryModule,
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
    WalletModule,
    TasksModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: TransientDbFilter },
    { provide: APP_INTERCEPTOR, useClass: TransientDbRetryInterceptor },
  ],
})
export class AppModule {}
