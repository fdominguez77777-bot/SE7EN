import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  EnvironmentVariables,
  validateEnvironment,
} from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { BidInvitationsModule } from './bid-invitations/bid-invitations.module';
import { BidSubmissionsModule } from './bid-submissions/bid-submissions.module';
import { BidderProfilesModule } from './bidder-profiles/bidder-profiles.module';
import { HealthModule } from './health/health.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        type: 'postgres' as const,
        host: config.get('DATABASE_HOST', { infer: true }),
        port: config.get('DATABASE_PORT', { infer: true }),
        username: config.get('DATABASE_USER', { infer: true }),
        password: config.get('DATABASE_PASSWORD', { infer: true }),
        database: config.get('DATABASE_NAME', { infer: true }),
        autoLoadEntities: true,
        synchronize: config.get('DB_SYNCHRONIZE', { infer: true }),
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    BidderProfilesModule,
    ProjectsModule,
    BidInvitationsModule,
    BidSubmissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
