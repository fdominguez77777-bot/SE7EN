import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { ActivityEvent } from '../activity/activity-event.entity';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import {
  assertTalynBulkSize,
  resolveTalynApplicationId,
  talynIdentity,
} from './application-ingest';
import { TalynBulkSyncDto, TalynSyncDto } from './dto/talyn-sync.dto';
import { JobApplication } from './job-application.entity';
import {
  JobApplicationSource,
  JobApplicationStatus,
  buildApplicationActivityEvent,
  requireAssignedBidderId,
} from './job-application.rules';

type SyncStatus = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'ERROR';

@Injectable()
export class TalynSyncService {
  constructor(
    @InjectRepository(JobApplication)
    private readonly applications: Repository<JobApplication>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    private readonly dataSource: DataSource,
  ) {}

  async validate(dto: TalynSyncDto) {
    const talynApplicationId = this.requireTalynApplicationId(dto);
    const profile = await this.profiles.findOne({
      where: { id: dto.candidateProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }
    const bidderId = requireAssignedBidderId(profile.assignedBidderId);
    if (!bidderId) {
      throw new BadRequestException(
        'Candidate must be assigned to a bidder before recording an application.',
      );
    }
    const existing = await this.findByTalynId(talynApplicationId);
    return {
      talynApplicationId,
      candidateProfileId: dto.candidateProfileId,
      bidderId,
      wouldCreate: !existing,
    };
  }

  async syncOne(dto: TalynSyncDto, createdByUserId: number | null) {
    return this.dataSource.transaction((manager) =>
      this.upsert(dto, createdByUserId, manager),
    );
  }

  async syncBulk(dto: TalynBulkSyncDto, createdByUserId: number | null) {
    const sizeError = assertTalynBulkSize(dto.applications.length);
    if (sizeError) {
      throw new BadRequestException(sizeError);
    }
    const items: {
      talynApplicationId: string;
      status: SyncStatus;
      applicationId?: number;
      error?: string;
    }[] = [];
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    for (const row of dto.applications) {
      const talynApplicationId = resolveTalynApplicationId(row);
      try {
        const result = await this.dataSource.transaction((manager) =>
          this.upsert(row, createdByUserId, manager),
        );
        items.push({
          talynApplicationId,
          status: result.status,
          applicationId: result.application.id,
        });
        if (result.status === 'CREATED') created += 1;
        else if (result.status === 'UPDATED') updated += 1;
        else unchanged += 1;
      } catch (error) {
        failed += 1;
        items.push({
          talynApplicationId,
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return {
      summary: {
        received: dto.applications.length,
        created,
        updated,
        unchanged,
        failed,
      },
      items,
    };
  }

  private requireTalynApplicationId(dto: TalynSyncDto) {
    const id = resolveTalynApplicationId(dto);
    if (!id) {
      throw new BadRequestException('talynApplicationId is required');
    }
    return id;
  }

  private async findByTalynId(
    talynApplicationId: string,
    manager?: EntityManager,
  ) {
    const apps = manager
      ? manager.getRepository(JobApplication)
      : this.applications;
    return apps.findOne({ where: { talynApplicationId } });
  }

  private async upsert(
    dto: TalynSyncDto,
    createdByUserId: number | null,
    manager: EntityManager,
  ) {
    const talynApplicationId = this.requireTalynApplicationId(dto);
    const identity = talynIdentity(talynApplicationId);
    const profiles = manager.getRepository(BidderProfile);
    const apps = manager.getRepository(JobApplication);
    const activity = manager.getRepository(ActivityEvent);
    const profile = await profiles.findOne({
      where: { id: dto.candidateProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }
    const bidderId = requireAssignedBidderId(profile.assignedBidderId);
    if (!bidderId) {
      throw new BadRequestException(
        'Candidate must be assigned to a bidder before recording an application.',
      );
    }
    const existing = await this.findByTalynId(talynApplicationId, manager);
    const appliedAt = new Date(dto.appliedAt);
    if (existing) {
      const next = {
        companyName: dto.companyName.trim(),
        jobTitle: dto.jobTitle.trim(),
        location: dto.location?.trim() || null,
        jobUrl: dto.jobUrl?.trim() || null,
        jobDescriptionText: dto.jobDescriptionText?.trim() || null,
        resumeText: dto.resumeText?.trim() || null,
        status: dto.status || existing.status,
        notes: dto.notes === undefined ? existing.notes : dto.notes.trim() || null,
      };
      const changed =
        next.companyName !== existing.companyName ||
        next.jobTitle !== existing.jobTitle ||
        next.location !== existing.location ||
        next.jobUrl !== existing.jobUrl ||
        next.jobDescriptionText !== existing.jobDescriptionText ||
        next.resumeText !== existing.resumeText ||
        next.status !== existing.status ||
        next.notes !== existing.notes;
      Object.assign(existing, next);
      const saved = await apps.save(existing);
      return {
        status: (changed ? 'UPDATED' : 'UNCHANGED') as SyncStatus,
        application: this.toDto(saved),
      };
    }
    const saved = await apps.save(
      apps.create({
        candidateProfileId: dto.candidateProfileId,
        bidderId,
        createdByUserId,
        companyName: dto.companyName.trim(),
        jobTitle: dto.jobTitle.trim(),
        location: dto.location?.trim() || null,
        jobUrl: dto.jobUrl?.trim() || null,
        source: JobApplicationSource.TALYN,
        sourceExternalId: identity.sourceExternalId,
        talynApplicationId,
        appliedAt,
        status: dto.status || JobApplicationStatus.APPLIED,
        jobDescriptionText: dto.jobDescriptionText?.trim() || null,
        resumeText: dto.resumeText?.trim() || null,
        notes: dto.notes?.trim() || null,
      }),
    );
    await activity.save(
      activity.create(
        buildApplicationActivityEvent({
          candidateProfileId: saved.candidateProfileId,
          bidderId,
          appliedAt: saved.appliedAt,
          createdById: createdByUserId,
          jobApplicationId: saved.id,
        }),
      ),
    );
    return { status: 'CREATED' as const, application: this.toDto(saved) };
  }

  private toDto(row: JobApplication) {
    return {
      id: row.id,
      talynApplicationId: row.talynApplicationId,
      candidateProfileId: row.candidateProfileId,
      bidderId: row.bidderId,
      companyName: row.companyName,
      jobTitle: row.jobTitle,
      status: row.status,
      source: row.source,
      appliedAt: row.appliedAt,
    };
  }
}
