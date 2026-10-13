import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { CallerProfile } from './caller-profile.entity';
import { CallersController } from './callers.controller';
import { CallersService } from './callers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallerProfile, BidderProfile, User]),
    AuthModule,
    UsersModule,
  ],
  controllers: [CallersController],
  providers: [CallersService],
  exports: [CallersService],
})
export class CallersModule {}
