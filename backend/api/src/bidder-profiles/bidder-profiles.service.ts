import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { BidderProfile } from './bidder-profile.entity';
import { CreateBidderProfileDto } from './dto/create-bidder-profile.dto';
import { UpdateBidderProfileDto } from './dto/update-bidder-profile.dto';

@Injectable()
export class BidderProfilesService {
  constructor(
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateBidderProfileDto, actor: User): Promise<BidderProfile> {
    if (isBidder(actor) && actor.bidderProfileId) {
      throw new ConflictException('Bidder already has a profile');
    }

    const profile = await this.profiles.save(
      this.profiles.create({
        name: dto.name.trim(),
        legalName: dto.legalName?.trim() ?? null,
      }),
    );

    if (isBidder(actor)) {
      await this.usersService.assignBidderProfile(actor.id, profile.id);
      actor.bidderProfileId = profile.id;
    }

    return profile;
  }

  async findAll(actor: User): Promise<BidderProfile[]> {
    if (isStaff(actor)) {
      return this.profiles.find({ order: { id: 'ASC' } });
    }

    if (!actor.bidderProfileId) {
      return [];
    }

    const profile = await this.profiles.findOne({
      where: { id: actor.bidderProfileId },
    });
    return profile ? [profile] : [];
  }

  async findOne(id: number, actor: User): Promise<BidderProfile> {
    const profile = await this.profiles.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException('Bidder profile not found');
    }
    this.assertCanAccess(profile, actor);
    return profile;
  }

  async update(
    id: number,
    dto: UpdateBidderProfileDto,
    actor: User,
  ): Promise<BidderProfile> {
    const profile = await this.findOne(id, actor);
    if (dto.name !== undefined) {
      profile.name = dto.name.trim();
    }
    if (dto.legalName !== undefined) {
      profile.legalName = dto.legalName.trim();
    }
    if (dto.status !== undefined) {
      profile.status = dto.status;
    }
    return this.profiles.save(profile);
  }

  async remove(id: number, actor: User): Promise<void> {
    const profile = await this.findOne(id, actor);
    await this.profiles.remove(profile);
  }

  private assertCanAccess(profile: BidderProfile, actor: User): void {
    if (isStaff(actor)) {
      return;
    }
    if (isBidder(actor) && actor.bidderProfileId === profile.id) {
      return;
    }
    throw new ForbiddenException();
  }
}
