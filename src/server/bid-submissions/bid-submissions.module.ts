import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Project } from '../projects/project.entity';
import { BidSubmission } from './bid-submission.entity';
import { BidSubmissionsController } from './bid-submissions.controller';
import { BidSubmissionsService } from './bid-submissions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BidSubmission, BidInvitation, Project, BidderProfile]),
    AuthModule,
    AuditModule,
  ],
  controllers: [BidSubmissionsController],
  providers: [BidSubmissionsService],
  exports: [BidSubmissionsService],
})
export class BidSubmissionsModule {}
