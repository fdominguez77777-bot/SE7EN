import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { InvitationStatus } from '../bid-invitations/invitation-status.enum';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/project-status.enum';
import { User } from '../users/user.entity';
import { BidSubmission } from './bid-submission.entity';
import { CreateBidSubmissionDto } from './dto/create-bid-submission.dto';
import { UpdateBidSubmissionDto } from './dto/update-bid-submission.dto';
import { SubmissionStatus } from './submission-status.enum';

@Injectable()
export class BidSubmissionsService {
  constructor(
    @InjectRepository(BidSubmission)
    private readonly submissions: Repository<BidSubmission>,
    @InjectRepository(BidInvitation)
    private readonly invitations: Repository<BidInvitation>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  async create(
    dto: CreateBidSubmissionDto,
    actor: User,
  ): Promise<BidSubmission> {
    if (!isBidder(actor) || !actor.bidderProfileId) {
      throw new ForbiddenException('Bidder profile required to submit a bid');
    }

    const project = await this.projects.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.status !== ProjectStatus.OPEN) {
      throw new ForbiddenException('Project is not open for bids');
    }

    const invitation = await this.invitations.findOne({
      where: {
        projectId: dto.projectId,
        bidderProfileId: actor.bidderProfileId,
      },
    });
    if (!invitation || invitation.status === InvitationStatus.DECLINED) {
      throw new ForbiddenException('No valid invitation for this project');
    }

    const existing = await this.submissions.findOne({
      where: {
        projectId: dto.projectId,
        bidderProfileId: actor.bidderProfileId,
      },
    });
    if (existing) {
      throw new ConflictException('A bid already exists for this project');
    }

    return this.submissions.save(
      this.submissions.create({
        projectId: dto.projectId,
        bidderProfileId: actor.bidderProfileId,
        invitationId: invitation.id,
        notes: dto.notes?.trim() ?? null,
        status: SubmissionStatus.SUBMITTED,
        createdById: actor.id,
      }),
    );
  }

  async findAll(actor: User, projectId?: number): Promise<BidSubmission[]> {
    if (isStaff(actor)) {
      return this.submissions.find({
        where: projectId ? { projectId } : {},
        order: { id: 'ASC' },
      });
    }

    if (!actor.bidderProfileId) {
      return [];
    }

    return this.submissions.find({
      where: projectId
        ? { projectId, bidderProfileId: actor.bidderProfileId }
        : { bidderProfileId: actor.bidderProfileId },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number, actor: User): Promise<BidSubmission> {
    const submission = await this.submissions.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Bid submission not found');
    }
    this.assertCanAccess(submission, actor);
    return submission;
  }

  async update(
    id: number,
    dto: UpdateBidSubmissionDto,
    actor: User,
  ): Promise<BidSubmission> {
    const submission = await this.findOne(id, actor);

    if (isBidder(actor)) {
      if (submission.status === SubmissionStatus.WITHDRAWN) {
        throw new ForbiddenException();
      }
      if (dto.notes !== undefined) {
        submission.notes = dto.notes.trim();
      }
      if (dto.status === SubmissionStatus.WITHDRAWN) {
        submission.status = SubmissionStatus.WITHDRAWN;
      } else if (dto.status !== undefined && dto.status !== submission.status) {
        throw new ForbiddenException();
      }
      return this.submissions.save(submission);
    }

    if (dto.notes !== undefined) {
      submission.notes = dto.notes.trim();
    }
    if (dto.status !== undefined) {
      submission.status = dto.status;
    }
    return this.submissions.save(submission);
  }

  async remove(id: number, actor: User): Promise<void> {
    const submission = await this.findOne(id, actor);
    if (isBidder(actor) && submission.status !== SubmissionStatus.DRAFT) {
      throw new ForbiddenException('Only draft bids can be deleted by bidders');
    }
    await this.submissions.remove(submission);
  }

  private assertCanAccess(submission: BidSubmission, actor: User): void {
    if (isStaff(actor)) {
      return;
    }
    if (isBidder(actor) && actor.bidderProfileId === submission.bidderProfileId) {
      return;
    }
    throw new ForbiddenException();
  }
}
