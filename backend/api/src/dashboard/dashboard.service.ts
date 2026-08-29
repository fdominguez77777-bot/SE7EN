import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { InvitationStatus } from '../bid-invitations/invitation-status.enum';
import { BidSubmission } from '../bid-submissions/bid-submission.entity';
import { SubmissionStatus } from '../bid-submissions/submission-status.enum';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/project-status.enum';
import { User } from '../users/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(BidInvitation)
    private readonly invitations: Repository<BidInvitation>,
    @InjectRepository(BidSubmission)
    private readonly submissions: Repository<BidSubmission>,
  ) {}

  async getSummary(actor: User) {
    if (isStaff(actor)) {
      const [openProjects, submissionsToReview, invitationsSent] =
        await Promise.all([
          this.projects.count({ where: { status: ProjectStatus.OPEN } }),
          this.submissions.count({
            where: { status: SubmissionStatus.SUBMITTED },
          }),
          this.invitations.count(),
        ]);
      return {
        role: actor.role,
        openProjects,
        submissionsToReview,
        invitationsSent,
      };
    }

    if (isBidder(actor) && actor.bidderProfileId) {
      const [pendingInvitations, mySubmissions, openProjects] = await Promise.all([
        this.invitations.count({
          where: {
            bidderProfileId: actor.bidderProfileId,
            status: InvitationStatus.INVITED,
          },
        }),
        this.submissions.count({
          where: { bidderProfileId: actor.bidderProfileId },
        }),
        this.projects.count({ where: { status: ProjectStatus.OPEN } }),
      ]);
      return {
        role: actor.role,
        pendingInvitations,
        mySubmissions,
        bidderProfileId: actor.bidderProfileId,
        openProjects,
      };
    }

    return {
      role: actor.role,
      pendingInvitations: 0,
      mySubmissions: 0,
      bidderProfileId: actor.bidderProfileId,
      openProjects: 0,
    };
  }
}
