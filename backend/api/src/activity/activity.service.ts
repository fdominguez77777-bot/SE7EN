import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { User } from '../users/user.entity';
import { ActivityEvent, ActivitySource, ActivityType } from './activity-event.entity';
import { CreateActivityAdjustmentDto } from './dto/create-activity-adjustment.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityEvent)
    private readonly events: Repository<ActivityEvent>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
  ) {}

  async adjust(dto: CreateActivityAdjustmentDto, actor: User) {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can record activity');
    }
    if (dto.delta === 0) {
      throw new BadRequestException('delta cannot be 0');
    }
    const profile = await this.profiles.findOne({
      where: { id: dto.candidateProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }
    const saved = await this.events.save(
      this.events.create({
        candidateProfileId: dto.candidateProfileId,
        type: dto.type,
        delta: dto.delta,
        source: ActivitySource.MANUAL,
        note: dto.note?.trim() || null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdById: actor.id,
      }),
    );
    return {
      id: saved.id,
      candidateProfileId: saved.candidateProfileId,
      type: saved.type,
      delta: saved.delta,
      source: saved.source,
      note: saved.note,
      occurredAt: saved.occurredAt,
    };
  }

  async summarize(actor: User, from: Date, to: Date) {
    const whereProfileIds = await this.visibleProfileIds(actor);
    if (whereProfileIds !== null && whereProfileIds.length === 0) {
      return [];
    }
    const qb = this.events
      .createQueryBuilder('event')
      .select('event.candidateProfileId', 'candidateProfileId')
      .addSelect('event.type', 'type')
      .addSelect('SUM(event.delta)', 'total')
      .where('event.occurredAt >= :from AND event.occurredAt < :to', { from, to })
      .groupBy('event.candidateProfileId')
      .addGroupBy('event.type');
    if (whereProfileIds) {
      qb.andWhere('event.candidateProfileId IN (:...ids)', {
        ids: whereProfileIds,
      });
    }
    const rows = await qb.getRawMany<{
      candidateProfileId: string;
      type: string;
      total: string;
    }>();

    const profiles = await this.profiles.find({
      order: { id: 'ASC' },
    });
    const visible = whereProfileIds
      ? profiles.filter((profile) => whereProfileIds.includes(profile.id))
      : profiles;

    return visible.map((profile) => {
      const forProfile = rows.filter(
        (row) => Number(row.candidateProfileId) === profile.id,
      );
      const count = (type: string) =>
        Number(
          forProfile.find((row) => row.type === type)?.total ?? 0,
        );
      return {
        candidateProfileId: profile.id,
        profileName: profile.name,
        resumesGenerated: count(ActivityType.RESUME),
        applications: count(ActivityType.APPLICATION),
        interviews: count(ActivityType.INTERVIEW),
      };
    });
  }

  private async visibleProfileIds(actor: User): Promise<number[] | null> {
    if (isStaff(actor)) {
      return null;
    }
    if (isBidder(actor) && actor.bidderProfileId) {
      return [actor.bidderProfileId];
    }
    return [];
  }
}
