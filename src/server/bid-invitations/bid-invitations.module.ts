import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Project } from '../projects/project.entity';
import { BidInvitation } from './bid-invitation.entity';
import { BidInvitationsController } from './bid-invitations.controller';
import { BidInvitationsService } from './bid-invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BidInvitation, Project, BidderProfile]),
    AuthModule,
  ],
  controllers: [BidInvitationsController],
  providers: [BidInvitationsService],
  exports: [BidInvitationsService],
})
export class BidInvitationsModule {}
