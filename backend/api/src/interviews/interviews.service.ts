import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { canBidderRecordForCandidate } from '../job-applications/job-application.rules';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { User } from '../users/user.entity';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { Interview } from './interview.entity';
import {
  applicationStatusAfterInterviewCreate,
  canBidderCreateLinkedInterview,
  canBidderViewInterview,
  deriveInterviewFromApplication,
  InterviewStatus,
  snapshotInterviewBidderId,
} from './interview.rules';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    @InjectRepository(JobApplication)
    private readonly applications: Repository<JobApplication>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateInterviewDto, actor: User) {
    const startsAt = parseStartsAt(dto.startsAt);
    return this.dataSource.transaction(async (manager) => {
      const interviews = manager.getRepository(Interview);
      const profiles = manager.getRepository(BidderProfile);
      const applications = manager.getRepository(JobApplication);

      let candidateProfileId: number;
      let company: string;
      let jobTitle: string;
      let jobApplicationId: number | null = null;
      let bidderId: number | null;
      let application: JobApplication | null = null;

      if (dto.jobApplicationId) {
        application = await applications.findOne({
          where: { id: dto.jobApplicationId },
          relations: { candidateProfile: true },
        });
        if (!application) {
          throw new NotFoundException('Application not found');
        }
        if (isBidder(actor)) {
          if (
            !canBidderCreateLinkedInterview({
              actorId: actor.id,
              applicationBidderId: application.bidderId,
              candidateAssignedBidderId: application.candidateProfile?.assignedBidderId,
            })
          ) {
            throw new ForbiddenException(
              'You cannot add an interview to this application',
            );
          }
        } else if (!isStaff(actor)) {
          throw new ForbiddenException('You cannot create interviews');
        }
        const derived = deriveInterviewFromApplication(application);
        candidateProfileId = derived.candidateProfileId;
        company = derived.company;
        jobTitle = derived.jobTitle;
        bidderId = derived.bidderId;
        jobApplicationId = application.id;
      } else {
        if (!dto.candidateProfileId || !dto.company?.trim() || !dto.jobTitle?.trim()) {
          throw new BadRequestException(
            'Candidate, company, and job title are required for a manual interview',
          );
        }
        const profile = await profiles.findOne({
          where: { id: dto.candidateProfileId },
        });
        if (!profile) {
          throw new NotFoundException('Candidate profile not found');
        }
        if (isBidder(actor) && !canBidderRecordForCandidate(profile.assignedBidderId, actor.id)) {
          throw new ForbiddenException(
            'You can only create interviews for candidates assigned to you',
          );
        }
        if (!isStaff(actor) && !isBidder(actor)) {
          throw new ForbiddenException('You cannot create interviews');
        }
        candidateProfileId = profile.id;
        company = dto.company.trim();
        jobTitle = dto.jobTitle.trim();
        bidderId = snapshotInterviewBidderId({
          assignedBidderId: profile.assignedBidderId,
        });
      }

      const saved = await interviews.save(
        interviews.create({
          candidateProfileId,
          jobApplicationId,
          bidderId,
          company,
          jobTitle,
          startsAt,
          round: dto.round?.trim() || null,
          method: dto.method,
          status: dto.status || InterviewStatus.SCHEDULED,
          source: dto.source?.trim() || null,
          result: dto.result?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: actor.id,
        }),
      );

      if (application) {
        const nextStatus = applicationStatusAfterInterviewCreate(application.status);
        if (nextStatus !== application.status) {
          application.status = nextStatus;
          await applications.save(application);
        }
      }

      const loaded = await interviews.findOne({
        where: { id: saved.id },
        relations: {
          candidateProfile: true,
          jobApplication: true,
          bidder: true,
        },
      });
      return this.toDto(loaded ?? saved);
    });
  }

  async findAll(
    actor: User,
    filters: { from?: Date; to?: Date; applicationId?: number } = {},
  ) {
    const qb = this.interviews
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.candidateProfile', 'profile')
      .leftJoinAndSelect('interview.jobApplication', 'application')
      .leftJoinAndSelect('interview.bidder', 'bidder')
      .orderBy('interview.startsAt', 'ASC')
      .addOrderBy('interview.id', 'ASC');
    if (filters.from) {
      qb.andWhere('interview.startsAt >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('interview.startsAt < :to', { to: filters.to });
    }
    if (filters.applicationId) {
      qb.andWhere('interview.jobApplicationId = :applicationId', {
        applicationId: filters.applicationId,
      });
    }
    if (isBidder(actor)) {
      qb.andWhere(
        '(interview.bidderId = :bidderId OR profile.assignedBidderId = :bidderId)',
        { bidderId: actor.id },
      );
    } else if (!isStaff(actor)) {
      return [];
    }
    const rows = await qb.getMany();
    return rows.map((row) => this.toDto(row));
  }

  async findOne(id: number, actor: User) {
    const row = await this.requireRow(id, actor);
    return this.toDto(row);
  }

  async update(id: number, dto: UpdateInterviewDto, actor: User) {
    const row = await this.requireRow(id, actor);
    this.assertCanMutate(row, actor);
    if (dto.company !== undefined) {
      row.company = dto.company.trim();
    }
    if (dto.jobTitle !== undefined) {
      row.jobTitle = dto.jobTitle.trim();
    }
    if (dto.startsAt !== undefined) {
      row.startsAt = parseStartsAt(dto.startsAt);
    }
    if (dto.round !== undefined) {
      row.round = dto.round?.trim() || null;
    }
    if (dto.method !== undefined) {
      row.method = dto.method;
    }
    if (dto.status !== undefined) {
      row.status = dto.status;
    }
    if (dto.source !== undefined) {
      row.source = dto.source?.trim() || null;
    }
    if (dto.result !== undefined) {
      row.result = dto.result?.trim() || null;
    }
    if (dto.notes !== undefined) {
      row.notes = dto.notes?.trim() || null;
    }
    await this.interviews.save(row);
    return this.findOne(id, actor);
  }

  async remove(id: number, actor: User): Promise<void> {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can delete interviews');
    }
    const row = await this.requireRow(id, actor);
    await this.interviews.remove(row);
  }

  private async requireRow(id: number, actor: User): Promise<Interview> {
    const row = await this.interviews.findOne({
      where: { id },
      relations: {
        candidateProfile: true,
        jobApplication: true,
        bidder: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Interview not found');
    }
    this.assertCanView(row, actor);
    return row;
  }

  private assertCanView(row: Interview, actor: User) {
    if (isStaff(actor)) {
      return;
    }
    if (
      isBidder(actor) &&
      canBidderViewInterview({
        actorId: actor.id,
        interviewBidderId: row.bidderId,
        candidateAssignedBidderId: row.candidateProfile?.assignedBidderId,
      })
    ) {
      return;
    }
    throw new ForbiddenException('You cannot access this interview');
  }

  private assertCanMutate(row: Interview, actor: User) {
    if (isStaff(actor)) {
      return;
    }
    if (
      isBidder(actor) &&
      canBidderViewInterview({
        actorId: actor.id,
        interviewBidderId: row.bidderId,
        candidateAssignedBidderId: row.candidateProfile?.assignedBidderId,
      })
    ) {
      return;
    }
    throw new ForbiddenException('You cannot change this interview');
  }

  private toDto(row: Interview) {
    const application = row.jobApplication;
    return {
      id: row.id,
      candidateProfileId: row.candidateProfileId,
      profileName: row.candidateProfile?.name ?? null,
      jobApplicationId: row.jobApplicationId,
      applicationCompany: application?.companyName ?? null,
      applicationJobTitle: application?.jobTitle ?? null,
      bidderId: row.bidderId,
      bidderName: row.bidder?.name ?? null,
      company: row.company,
      jobTitle: row.jobTitle,
      startsAt: row.startsAt,
      round: row.round,
      source: row.source,
      status: row.status || InterviewStatus.SCHEDULED,
      method: row.method,
      result: row.result,
      notes: row.notes,
      createdById: row.createdById,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

function parseStartsAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Interview date/time is invalid');
  }
  return date;
}
