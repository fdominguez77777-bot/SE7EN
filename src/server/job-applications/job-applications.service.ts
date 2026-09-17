import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { Interview } from '../interviews/interview.entity';
import { User } from '../users/user.entity';
import { UnconfiguredTalynApplicationClient } from '../integrations/talyn/talyn-application.client';
import { UpdateJobApplicationDto } from './dto/update-job-application.dto';
import { JobApplication } from './job-application.entity';
import {
  canBidderMutateApplication,
  canBidderViewApplication,
} from './job-application.rules';

const RELATIONS = {
  candidateProfile: true,
  bidder: true,
  createdByUser: true,
} as const;

@Injectable()
export class JobApplicationsService {
  constructor(
    @InjectRepository(JobApplication)
    private readonly applications: Repository<JobApplication>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly talynClient: UnconfiguredTalynApplicationClient,
  ) {}

  integrationStatus() {
    const ingestKey =
      this.config.get('TALYN_INGEST_API_KEY', { infer: true })?.trim() ?? '';
    return {
      sourceOfTruth: 'talyn' as const,
      ingestConfigured: Boolean(ingestKey),
      outboundPull: this.talynClient.outboundStatus(),
    };
  }

  async findAll(
    actor: User,
    filters: {
      candidateProfileId?: number;
      bidderId?: number;
      status?: string;
      source?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    const qb = this.applications
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.candidateProfile', 'profile')
      .leftJoinAndSelect('app.bidder', 'bidder')
      .leftJoinAndSelect('app.createdByUser', 'createdBy')
      .orderBy('app.appliedAt', 'DESC')
      .addOrderBy('app.id', 'DESC');
    if (isBidder(actor)) {
      qb.andWhere(
        '(app.bidderId = :bidderId OR profile.assignedBidderId = :bidderId)',
        { bidderId: actor.id },
      );
    } else if (!isStaff(actor)) {
      return [];
    }
    if (filters.candidateProfileId) {
      qb.andWhere('app.candidateProfileId = :candidateProfileId', {
        candidateProfileId: filters.candidateProfileId,
      });
    }
    if (filters.bidderId && isStaff(actor)) {
      qb.andWhere('app.bidderId = :filterBidderId', {
        filterBidderId: filters.bidderId,
      });
    }
    if (filters.status) {
      qb.andWhere('app.status = :status', { status: filters.status });
    }
    if (filters.source) {
      qb.andWhere('app.source = :source', { source: filters.source });
    }
    if (filters.from) {
      qb.andWhere('app.appliedAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('app.appliedAt < :to', { to: filters.to });
    }
    const rows = await qb.getMany();
    const counts = await this.interviewCounts(rows.map((row) => row.id));
    return rows.map((row) =>
      this.toDto(
        Object.assign(row, { interviewCount: counts.get(row.id) ?? 0 }),
        false,
      ),
    );
  }

  async findOne(id: number, actor: User) {
    const row = await this.applications.findOne({
      where: { id },
      relations: RELATIONS,
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    this.assertCanView(row, actor);
    const interviews = await this.dataSource.getRepository(Interview).find({
      where: { jobApplicationId: row.id },
      order: { startsAt: 'ASC', id: 'ASC' },
    });
    return this.toDto(row, true, interviews);
  }

  private async interviewCounts(ids: number[]) {
    const counts = new Map<number, number>();
    if (ids.length === 0) {
      return counts;
    }
    const raw = await this.dataSource
      .getRepository(Interview)
      .createQueryBuilder('i')
      .select('i.jobApplicationId', 'jobApplicationId')
      .addSelect('COUNT(i.id)', 'count')
      .where('i.jobApplicationId IN (:...ids)', { ids })
      .groupBy('i.jobApplicationId')
      .getRawMany();
    for (const item of raw as { jobApplicationId: number; count: string }[]) {
      counts.set(Number(item.jobApplicationId), Number(item.count));
    }
    return counts;
  }

  async update(id: number, dto: UpdateJobApplicationDto, actor: User) {
    const row = await this.requireRow(id, actor);
    this.assertCanMutate(row, actor);
    if (dto.companyName !== undefined) {
      row.companyName = dto.companyName.trim();
    }
    if (dto.jobTitle !== undefined) {
      row.jobTitle = dto.jobTitle.trim();
    }
    if (dto.location !== undefined) {
      row.location = dto.location?.trim() || null;
    }
    if (dto.jobUrl !== undefined) {
      row.jobUrl = dto.jobUrl?.trim() || null;
    }
    if (dto.source !== undefined) {
      row.source = dto.source;
    }
    if (dto.sourceExternalId !== undefined) {
      if (!isStaff(actor)) {
        throw new ForbiddenException('Only staff can change the external id');
      }
      row.sourceExternalId = dto.sourceExternalId?.trim() || null;
    }
    if (dto.appliedAt !== undefined) {
      row.appliedAt = new Date(dto.appliedAt);
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }
    if (dto.jobDescriptionText !== undefined) {
      row.jobDescriptionText = dto.jobDescriptionText?.trim() || null;
    }
    if (dto.resumeText !== undefined) {
      row.resumeText = dto.resumeText?.trim() || null;
    }
    if (dto.notes !== undefined) {
      row.notes = dto.notes?.trim() || null;
    }
    await this.applications.save(row);
    return this.findOne(id, actor);
  }

  private async requireRow(id: number, actor: User) {
    const row = await this.applications.findOne({
      where: { id },
      relations: RELATIONS,
    });
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    this.assertCanView(row, actor);
    return row;
  }

  private assertCanView(row: JobApplication, actor: User) {
    if (isStaff(actor)) {
      return;
    }
    if (
      isBidder(actor) &&
      canBidderViewApplication({
        actorId: actor.id,
        applicationBidderId: row.bidderId,
        candidateAssignedBidderId: row.candidateProfile?.assignedBidderId,
      })
    ) {
      return;
    }
    throw new ForbiddenException('You cannot access this application');
  }

  private assertCanMutate(row: JobApplication, actor: User) {
    if (isStaff(actor)) {
      return;
    }
    if (
      isBidder(actor) &&
      canBidderMutateApplication({
        actorId: actor.id,
        applicationBidderId: row.bidderId,
        candidateAssignedBidderId: row.candidateProfile?.assignedBidderId,
      })
    ) {
      return;
    }
    throw new ForbiddenException('You cannot change this application');
  }

  private toDto(
    row: JobApplication & { interviewCount?: number },
    includeDocuments: boolean,
    interviews: Interview[] = [],
  ) {
    const profile = row.candidateProfile;
    const dto: Record<string, unknown> = {
      id: row.id,
      talynApplicationId: row.talynApplicationId,
      candidateProfileId: row.candidateProfileId,
      profileName: profile?.name ?? null,
      candidateFullName: [profile?.firstName, profile?.middleName, profile?.lastName]
        .filter(Boolean)
        .join(' ') || null,
      bidderId: row.bidderId,
      bidderName: row.bidder?.name ?? null,
      bidderEmail: row.bidder?.email ?? null,
      createdByUserId: row.createdByUserId,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      location: row.location,
      jobUrl: row.jobUrl,
      source: row.source,
      sourceExternalId: row.sourceExternalId,
      appliedAt: row.appliedAt,
      status: row.status,
      notes: row.notes,
      interviewCount: row.interviewCount ?? interviews.length,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    if (includeDocuments) {
      dto.jobDescriptionText = row.jobDescriptionText;
      dto.resumeText = row.resumeText;
      dto.interviews = interviews.map((item) => ({
        id: item.id,
        round: item.round,
        startsAt: item.startsAt,
        method: item.method,
        status: item.status,
        result: item.result,
        notes: item.notes,
      }));
    }
    return dto;
  }
}
