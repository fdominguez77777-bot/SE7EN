import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { isBidder, isStaff } from '../auth/role-utils';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { User } from '../users/user.entity';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { Interview } from './interview.entity';

@Injectable()
export class InterviewsService {
  constructor(
    @InjectRepository(Interview)
    private readonly interviews: Repository<Interview>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
  ) {}

  async create(dto: CreateInterviewDto, actor: User) {
    this.assertStaff(actor);
    const profile = await this.profiles.findOne({
      where: { id: dto.candidateProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }
    const saved = await this.interviews.save(
      this.interviews.create({
        candidateProfileId: dto.candidateProfileId,
        company: dto.company.trim(),
        jobTitle: dto.jobTitle.trim(),
        startsAt: new Date(dto.startsAt),
        round: dto.round?.trim() || null,
        source: dto.source?.trim() || null,
        result: dto.result?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: actor.id,
      }),
    );
    return this.toDto(saved, profile.name);
  }

  async findAll(actor: User, from?: Date, to?: Date) {
    const qb = this.interviews
      .createQueryBuilder('interview')
      .leftJoinAndSelect('interview.candidateProfile', 'profile')
      .orderBy('interview.startsAt', 'ASC');
    if (from) {
      qb.andWhere('interview.startsAt >= :from', { from });
    }
    if (to) {
      qb.andWhere('interview.startsAt < :to', { to });
    }
    if (isBidder(actor)) {
      if (!actor.bidderProfileId) {
        return [];
      }
      qb.andWhere('interview.candidateProfileId = :profileId', {
        profileId: actor.bidderProfileId,
      });
    }
    const rows = await qb.getMany();
    return rows.map((row) => this.toDto(row, row.candidateProfile?.name ?? null));
  }

  async update(id: number, dto: UpdateInterviewDto, actor: User) {
    this.assertStaff(actor);
    const row = await this.requireRow(id, actor);
    if (dto.company !== undefined) {
      row.company = dto.company.trim();
    }
    if (dto.jobTitle !== undefined) {
      row.jobTitle = dto.jobTitle.trim();
    }
    if (dto.startsAt !== undefined) {
      row.startsAt = new Date(dto.startsAt);
    }
    if (dto.round !== undefined) {
      row.round = dto.round?.trim() || null;
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
    const saved = await this.interviews.save(row);
    return this.toDto(saved, null);
  }

  async remove(id: number, actor: User): Promise<void> {
    this.assertStaff(actor);
    const row = await this.requireRow(id, actor);
    await this.interviews.remove(row);
  }

  private async requireRow(id: number, actor: User): Promise<Interview> {
    const row = await this.interviews.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Interview not found');
    }
    this.assertCanAccess(row, actor);
    return row;
  }

  private assertStaff(actor: User) {
    if (!isStaff(actor)) {
      throw new ForbiddenException('Only staff can change interviews');
    }
  }

  private assertCanAccess(row: Interview, actor: User) {
    if (isStaff(actor)) {
      return;
    }
    if (isBidder(actor) && actor.bidderProfileId === row.candidateProfileId) {
      return;
    }
    throw new ForbiddenException('You cannot access this interview');
  }

  private toDto(row: Interview, profileName: string | null) {
    return {
      id: row.id,
      candidateProfileId: row.candidateProfileId,
      profileName,
      company: row.company,
      jobTitle: row.jobTitle,
      startsAt: row.startsAt,
      round: row.round,
      source: row.source,
      result: row.result,
      notes: row.notes,
      createdById: row.createdById,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
