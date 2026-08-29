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
import { User } from '../users/user.entity';
import { BidInvitation } from './bid-invitation.entity';
import { CreateBidInvitationDto } from './dto/create-bid-invitation.dto';
import { UpdateBidInvitationDto } from './dto/update-bid-invitation.dto';
import { InvitationStatus } from './invitation-status.enum';

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

  async create(
    dto: CreateBidInvitationDto,
    actor: User,
  ): Promise<BidInvitation> {
    const project = await this.projects.findOne({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
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

    return this.invitations.save(
      this.invitations.create({
        projectId: dto.projectId,
        bidderProfileId: dto.bidderProfileId,
        invitedById: actor.id,
        status: InvitationStatus.INVITED,
      }),
    );
  }

  async findAll(actor: User, projectId?: number): Promise<BidInvitation[]> {
    if (isStaff(actor)) {
      return this.invitations.find({
        where: projectId ? { projectId } : {},
        order: { id: 'ASC' },
      });
    }

    if (!actor.bidderProfileId) {
      return [];
    }

    return this.invitations.find({
      where: projectId
        ? { projectId, bidderProfileId: actor.bidderProfileId }
        : { bidderProfileId: actor.bidderProfileId },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number, actor: User): Promise<BidInvitation> {
    const invitation = await this.invitations.findOne({ where: { id } });
    if (!invitation) {
      throw new NotFoundException('Bid invitation not found');
    }
    this.assertCanAccess(invitation, actor);
    return invitation;
  }

  async update(
    id: number,
    dto: UpdateBidInvitationDto,
    actor: User,
  ): Promise<BidInvitation> {
    const invitation = await this.findOne(id, actor);

    if (isBidder(actor) && dto.status === InvitationStatus.INVITED) {
      throw new ForbiddenException();
    }

    invitation.status = dto.status;
    return this.invitations.save(invitation);
  }

  async remove(id: number, actor: User): Promise<void> {
    if (!isStaff(actor)) {
      throw new ForbiddenException();
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
    throw new ForbiddenException();
  }
}
