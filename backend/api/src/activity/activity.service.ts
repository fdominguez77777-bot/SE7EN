import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { assignedProfileIds } from '../bidder-profiles/assigned-profiles';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { JiracodersApplicationsService } from '../integrations/jiracoders/jiracoders.service';
import { User } from '../users/user.entity';
import { ActivityEvent, ActivitySource, ActivityType } from './activity-event.entity';
import { emptyCounts, rollupByBidderId, snapshotBidderId } from './activity-totals';
import { CreateActivityAdjustmentDto } from './dto/create-activity-adjustment.dto';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityEvent)
    private readonly events: Repository<ActivityEvent>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly applications: JiracodersApplicationsService,
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
    const bidderId = snapshotBidderId(profile.assignedBidderId);
    const saved = await this.events.save(
      this.events.create({
        candidateProfileId: dto.candidateProfileId,
        bidderId,
        type: dto.type,
        delta: dto.delta,
        source: ActivitySource.MANUAL,
        note: dto.note?.trim() || null,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        createdById: actor.id,
      }),
    );
    return this.toEventDto(saved, profile, null, actor);
  }

  async listEvents(
    actor: User,
    from: Date,
    to: Date,
    candidateProfileId?: number,
  ) {
    const qb = this.events
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.candidateProfile', 'profile')
      .leftJoinAndSelect('event.bidder', 'bidder')
      .where('event.occurredAt >= :from AND event.occurredAt < :to', { from, to })
      .orderBy('event.occurredAt', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(100);

    if (isStaff(actor)) {
      if (candidateProfileId) {
        qb.andWhere('event.candidateProfileId = :candidateProfileId', {
          candidateProfileId,
        });
      }
    } else if (isBidder(actor)) {
      qb.andWhere('event.bidderId = :bidderId', { bidderId: actor.id });
      if (candidateProfileId) {
        const assigned = await assignedProfileIds(this.profiles, actor.id);
        if (!assigned.includes(candidateProfileId)) {
          return [];
        }
        qb.andWhere('event.candidateProfileId = :candidateProfileId', {
          candidateProfileId,
        });
      }
    } else {
      return [];
    }

    const rows = await qb.getMany();
    return rows.map((row) =>
      this.toEventDto(row, row.candidateProfile, row.bidder, actor),
    );
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
        Number(forProfile.find((row) => row.type === type)?.total ?? 0);
      return {
        candidateProfileId: profile.id,
        profileName: profile.name,
        resumesGenerated: count(ActivityType.RESUME),
        applications: count(ActivityType.APPLICATION),
        interviews: count(ActivityType.INTERVIEW),
      };
    });
  }

  async summarizeByBidder(actor: User, from: Date, to: Date) {
    const qb = this.events
      .createQueryBuilder('event')
      .select('event.bidderId', 'bidderId')
      .addSelect('event.type', 'type')
      .addSelect('SUM(event.delta)', 'total')
      .where('event.occurredAt >= :from AND event.occurredAt < :to', { from, to })
      .andWhere('event.bidderId IS NOT NULL')
      .groupBy('event.bidderId')
      .addGroupBy('event.type');
    if (isBidder(actor)) {
      qb.andWhere('event.bidderId = :bidderId', { bidderId: actor.id });
    } else if (!isStaff(actor)) {
      return [];
    }
    const rows = await qb.getRawMany<{
      bidderId: string;
      type: string;
      total: string;
    }>();
    const totals = rollupByBidderId(
      rows.map((row) => ({
        bidderId: Number(row.bidderId),
        type: row.type,
        delta: Number(row.total),
      })),
    );
    const jiraCounts = await this.applicationCountsFromJira(from, to);
    const ids = new Set([...totals.keys(), ...jiraCounts.keys()]);
    if (isBidder(actor)) {
      ids.clear();
      ids.add(actor.id);
    }
    if (ids.size === 0) {
      return [];
    }
    const bidders = await this.users.find({
      where: { id: In([...ids]) },
    });
    const byId = new Map(bidders.map((row) => [row.id, row]));

    return [...ids].map((id) => {
      const counts = totals.get(id) ?? emptyCounts();
      const bidder = byId.get(id);
      return {
        bidderId: id,
        bidderName: bidder?.name ?? null,
        bidderEmail: bidder?.email ?? null,
        resumesGenerated: counts.resumesGenerated,
        applications: jiraCounts.has(id)
          ? (jiraCounts.get(id) ?? 0)
          : counts.applications,
        interviews: counts.interviews,
      };
    });
  }

  private async applicationCountsFromJira(from: Date, to: Date) {
    try {
      return await this.applications.applicationCountsByBidder(from, to);
    } catch {
      return new Map<number, number>();
    }
  }

  private toEventDto(
    row: ActivityEvent,
    profile: BidderProfile | null | undefined,
    bidder: User | null | undefined,
    actor: User,
  ) {
    const canSeeCandidate =
      isStaff(actor) ||
      (isBidder(actor) && profile?.assignedBidderId === actor.id);
    return {
      id: row.id,
      candidateProfileId: canSeeCandidate ? row.candidateProfileId : null,
      profileName: canSeeCandidate ? (profile?.name ?? null) : null,
      bidderId: row.bidderId,
      bidderName: bidder?.name ?? null,
      bidderEmail: bidder?.email ?? null,
      type: row.type,
      delta: row.delta,
      source: row.source,
      note: row.note,
      occurredAt: row.occurredAt,
    };
  }

  private async visibleProfileIds(actor: User): Promise<number[] | null> {
    if (isStaff(actor)) {
      return null;
    }
    if (isBidder(actor)) {
      return assignedProfileIds(this.profiles, actor.id);
    }
    return [];
  }
}
