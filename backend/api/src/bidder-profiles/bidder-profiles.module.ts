import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { BidderProfile } from './bidder-profile.entity';
import { BidderProfilesController } from './bidder-profiles.controller';
import { BidderProfilesService } from './bidder-profiles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BidderProfile]),
    UsersModule,
    AuthModule,
  ],
  controllers: [BidderProfilesController],
  providers: [BidderProfilesService],
  exports: [BidderProfilesService],
})
export class BidderProfilesModule {}
