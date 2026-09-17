import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { isBidder, isStaff } from '../auth/role-utils';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { InvitationStatus } from '../bid-invitations/invitation-status.enum';
import { assignedProfileIds } from '../bidder-profiles/assigned-profiles';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Project } from '../projects/project.entity';
import { bidWindowMessage, isWithinBidWindow } from '../projects/project-window';
import { User } from '../users/user.entity';
import { BidSubmission } from './bid-submission.entity';
import { CreateBidSubmissionDto } from './dto/create-bid-submission.dto';
import { UpdateBidSubmissionDto } from './dto/update-bid-submission.dto';
import { toSubmissionDto } from './submission.mapper';
import { SubmissionStatus } from './submission-status.enum';

const SUB_RELATIONS = { project: true, bidderProfile: true } as const;

@Injectable()
export class BidSubmissionsService {
  constructor(
    @InjectRepository(BidSubmission)
    private readonly submissions: Repository<BidSubmission>,
    @InjectRepository(BidInvitation)
    private readonly invitations: Repository<BidInvitation>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateBidSubmissionDto, actor: User) {
    if (!isBidder(actor)) {
      throw new ForbiddenException(
        'A linked bidder profile is required to submit a bid',
      );
    }
    const profileIds = await assignedProfileIds(this.profiles, actor.id);
    if (profileIds.length === 0) {
      throw new ForbiddenException(
        'A linked bidder profile is required to submit a bid',
      );
    }

    const project = await this.projects.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (!isWithinBidWindow(project)) {
      throw new ForbiddenException(bidWindowMessage(project));
    }

    const invitation = await this.invitations.findOne({
      where: {
        projectId: dto.projectId,
        bidderProfileId: In(profileIds),
        status: InvitationStatus.ACCEPTED,
      },
    });
    if (!invitation || invitation.status !== InvitationStatus.ACCEPTED) {
      throw new ForbiddenException(
        'You must accept the invitation before submitting a bid',
      );
    }

    const existing = await this.submissions.findOne({
      where: {
        projectId: dto.projectId,
        bidderProfileId: invitation.bidderProfileId,
      },
    });
    if (existing) {
      throw new ConflictException('A bid already exists for this project');
    }

    const saved = await this.submissions.save(
      this.submissions.create({
        projectId: dto.projectId,
        bidderProfileId: invitation.bidderProfileId,
        invitationId: invitation.id,
        amount: dto.amount.toFixed(2),
        currency: (dto.currency ?? 'USD').toUpperCase(),
        notes: dto.notes?.trim() ?? null,
        status: SubmissionStatus.SUBMITTED,
        createdById: actor.id,
      }),
    );
    return this.findOne(saved.id, actor);
  }

  async findAll(actor: User, projectId?: number) {
    if (isStaff(actor)) {
      const where = projectId ? { projectId } : {};
      const rows = await this.submissions.find({
        where,
        relations: SUB_RELATIONS,
        order: { id: 'ASC' },
      });
      return rows.map(toSubmissionDto);
    }
    const ids = await assignedProfileIds(this.profiles, actor.id);
    if (ids.length === 0) {
      return [];
    }
    const where = projectId
      ? { projectId, bidderProfileId: In(ids) }
      : { bidderProfileId: In(ids) };
    const rows = await this.submissions.find({
      where,
      relations: SUB_RELATIONS,
      order: { id: 'ASC' },
    });
    return rows.map(toSubmissionDto);
  }

  async findOne(id: number, actor: User) {
    const submission = await this.submissions.findOne({
      where: { id },
      relations: SUB_RELATIONS,
    });
    if (!submission) {
      throw new NotFoundException('Bid submission not found');
    }
    this.assertCanAccess(submission, actor);
    return toSubmissionDto(submission);
  }

  async update(id: number, dto: UpdateBidSubmissionDto, actor: User) {
    const submission = await this.requireRow(id, actor);
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      throw new ForbiddenException('Only submitted bids can be edited');
    }
    if (isBidder(actor)) {
      const project = await this.projects.findOne({
        where: { id: submission.projectId },
      });
      if (!project || !isWithinBidWindow(project)) {
        throw new ForbiddenException(
          project ? bidWindowMessage(project) : 'Project not found',
        );
      }
    }
    if (dto.notes !== undefined) {
      submission.notes = dto.notes.trim();
    }
    if (dto.amount !== undefined) {
      submission.amount = dto.amount.toFixed(2);
    }
    await this.submissions.save(submission);
    return this.findOne(id, actor);
  }

  async accept(id: number, actor: User) {
    this.assertStaff(actor);
    const submission = await this.requireRow(id, actor);
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted bids can be accepted');
    }
    submission.status = SubmissionStatus.ACCEPTED;
    await this.submissions.save(submission);
    await this.audit.record('submission', id, 'accept', actor.id);
    return this.findOne(id, actor);
  }

  async reject(id: number, actor: User) {
    this.assertStaff(actor);
    const submission = await this.requireRow(id, actor);
    if (
      submission.status !== SubmissionStatus.SUBMITTED &&
      submission.status !== SubmissionStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        'Only submitted or accepted bids can be rejected',
      );
    }
    submission.status = SubmissionStatus.REJECTED;
    await this.submissions.save(submission);
    await this.audit.record('submission', id, 'reject', actor.id);
    return this.findOne(id, actor);
  }

  async remove(id: number, actor: User): Promise<void> {
    this.assertStaff(actor);
    const submission = await this.requireRow(id, actor);
    await this.submissions.remove(submission);
  }

  private assertStaff(actor: User) {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can perform this action');
    }
  }

  private async requireRow(id: number, actor: User): Promise<BidSubmission> {
    const submission = await this.submissions.findOne({
      where: { id },
      relations: SUB_RELATIONS,
    });
    if (!submission) {
      throw new NotFoundException('Bid submission not found');
    }
    this.assertCanAccess(submission, actor);
    return submission;
  }

  private assertCanAccess(submission: BidSubmission, actor: User): void {
    if (isStaff(actor)) {
      return;
    }
    if (
      isBidder(actor) &&
      submission.bidderProfile?.assignedBidderId === actor.id
    ) {
      return;
    }
    throw new ForbiddenException('You cannot access this submission');
  }
}
