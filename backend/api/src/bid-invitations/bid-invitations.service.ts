import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { Project } from '../projects/project.entity';
import { ProjectStatus } from '../projects/project-status.enum';
import { User } from '../users/user.entity';
import { BidInvitation } from './bid-invitation.entity';
import { CreateBidInvitationDto } from './dto/create-bid-invitation.dto';
import { UpdateBidInvitationDto } from './dto/update-bid-invitation.dto';
import { toInvitationDto } from './invitation.mapper';
import { InvitationStatus } from './invitation-status.enum';

const INVITE_RELATIONS = { project: true, bidderProfile: true } as const;

@Injectable()
export class BidInvitationsService {
  constructor(
    @InjectRepository(BidInvitation)
    private readonly invitations: Repository<BidInvitation>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
  ) {}

  async create(dto: CreateBidInvitationDto, actor: User) {
    const project = await this.projects.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (
      project.status !== ProjectStatus.DRAFT &&
      project.status !== ProjectStatus.OPEN
    ) {
      throw new ForbiddenException(
        'Invitations can only be sent for DRAFT or OPEN projects',
      );
    }

    const profile = await this.profiles.findOne({
      where: { id: dto.bidderProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Bidder profile not found');
    }

    const existing = await this.invitations.findOne({
      where: {
        projectId: dto.projectId,
        bidderProfileId: dto.bidderProfileId,
      },
    });
    if (existing) {
      throw new ConflictException('Bidder is already invited to this project');
    }

    const saved = await this.invitations.save(
      this.invitations.create({
        projectId: dto.projectId,
        bidderProfileId: dto.bidderProfileId,
        invitedById: actor.id,
        status: InvitationStatus.INVITED,
      }),
    );
    return this.findOne(saved.id, actor);
  }

  async findAll(actor: User, projectId?: number) {
    const where = isStaff(actor)
      ? projectId
        ? { projectId }
        : {}
      : actor.bidderProfileId
        ? projectId
          ? { projectId, bidderProfileId: actor.bidderProfileId }
          : { bidderProfileId: actor.bidderProfileId }
        : null;
    if (where === null) {
      return [];
    }
    const rows = await this.invitations.find({
      where,
      relations: INVITE_RELATIONS,
      order: { id: 'ASC' },
    });
    return rows.map(toInvitationDto);
  }

  async findOne(id: number, actor: User) {
    const invitation = await this.invitations.findOne({
      where: { id },
      relations: INVITE_RELATIONS,
    });
    if (!invitation) {
      throw new NotFoundException('Bid invitation not found');
    }
    this.assertCanAccess(invitation, actor);
    return toInvitationDto(invitation);
  }

  async update(id: number, dto: UpdateBidInvitationDto, actor: User) {
    const invitation = await this.invitations.findOne({
      where: { id },
      relations: INVITE_RELATIONS,
    });
    if (!invitation) {
      throw new NotFoundException('Bid invitation not found');
    }
    this.assertCanAccess(invitation, actor);

    if (isBidder(actor)) {
      if (
        dto.status !== InvitationStatus.ACCEPTED &&
        dto.status !== InvitationStatus.DECLINED
      ) {
        throw new ForbiddenException('Bidders can only accept or decline');
      }
    }

    invitation.status = dto.status;
    await this.invitations.save(invitation);
    return this.findOne(id, actor);
  }

  async remove(id: number, actor: User): Promise<void> {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can delete invitations');
    }
    const invitation = await this.invitations.findOne({ where: { id } });
    if (!invitation) {
      throw new NotFoundException('Bid invitation not found');
    }
    await this.invitations.remove(invitation);
  }

  private assertCanAccess(invitation: BidInvitation, actor: User): void {
    if (isStaff(actor)) {
      return;
    }
    if (isBidder(actor) && actor.bidderProfileId === invitation.bidderProfileId) {
      return;
    }
    throw new ForbiddenException('You cannot access this invitation');
  }
}
