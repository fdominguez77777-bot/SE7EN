import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { ActivityEvent } from '../activity/activity-event.entity';
import { isBidder, isStaff } from '../auth/role-utils';
import { Interview } from '../interviews/interview.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { avatarPublicUrl } from '../storage/image-kind';
import { UsersService } from '../users/users.service';
import { BidderProfile } from './bidder-profile.entity';
import { CreateBidderProfileDto } from './dto/create-bidder-profile.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateBidderProfileDto } from './dto/update-bidder-profile.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';
import { Education } from './education.entity';
import { assignmentRejectedReason } from './assignment.rules';
import { toCandidateDto } from './profile.mapper';
import { WorkExperience } from './work-experience.entity';

const PROFILE_RELATIONS = {
  experiences: true,
  educations: true,
  assignedBidder: true,
} as const;

@Injectable()
export class BidderProfilesService {
  constructor(
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    @InjectRepository(WorkExperience)
    private readonly experiences: Repository<WorkExperience>,
    @InjectRepository(Education)
    private readonly educations: Repository<Education>,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateBidderProfileDto, actor: User) {
    this.assertAdmin(actor);
    const profileName = dto.profileName.trim();
    const saved = await this.profiles.save(
      this.profiles.create({
        name: profileName,
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        lastName: dto.lastName.trim(),
        contactName: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
        email: dto.email.trim().toLowerCase(),
        phone: dto.phoneNumber.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        gender: dto.gender?.trim() || null,
        dateOfBirth: dto.dateOfBirth || null,
        streetAddress: dto.streetAddress?.trim() || null,
        address: dto.streetAddress?.trim() || null,
        city: dto.city?.trim() || null,
        stateRegion: dto.stateRegion?.trim() || null,
        zipPostalCode: dto.zipPostalCode?.trim() || null,
        linkedinUrl: dto.linkedinUrl?.trim() || null,
        githubUrl: dto.githubUrl?.trim() || null,
        portfolioUrl: dto.portfolioUrl?.trim() || null,
        raceEthnicity: dto.raceEthnicity?.trim() || null,
        veteranStatus: dto.veteranStatus?.trim() || null,
        disabilityStatus: dto.disabilityStatus?.trim() || null,
      }),
    );
    await this.audit.record('candidate_profile', saved.id, 'create', actor.id, {
      profileId: saved.id,
    });
    return this.toDto(await this.requireProfile(saved.id), actor);
  }

  async findAll(actor: User) {
    if (isStaff(actor)) {
      const rows = await this.profiles.find({
        relations: PROFILE_RELATIONS,
        order: { id: 'ASC' },
      });
      return Promise.all(rows.map((row) => this.toDto(row, actor)));
    }
    const rows = await this.profiles.find({
      where: { assignedBidderId: actor.id },
      relations: PROFILE_RELATIONS,
      order: { id: 'ASC' },
    });
    return Promise.all(rows.map((row) => this.toDto(row, actor)));
  }

  async findOne(id: number, actor: User) {
    const profile = await this.requireProfile(id);
    this.assertCanAccess(profile, actor);
    return this.toDto(profile, actor);
  }

  async assignBidder(
    id: number,
    bidderId: number | null,
    actor: User,
  ) {
    this.assertAdmin(actor);
    const profile = await this.requireProfile(id);
    if (bidderId === null) {
      profile.assignedBidderId = null;
      profile.assignedBidder = null;
      await this.profiles.save(profile);
      await this.audit.record('candidate_profile', id, 'unassign', actor.id, {
        profileId: id,
      });
      return this.toDto(await this.requireProfile(id), actor);
    }
    const bidder = await this.usersService.findByIdOrFail(bidderId);
    const rejected = assignmentRejectedReason(bidder);
    if (rejected) {
      throw new BadRequestException(rejected);
    }
    await this.dataSource.transaction(async (manager) => {
      profile.assignedBidderId = bidder.id;
      await manager.save(profile);
      await manager.update(
        JobApplication,
        { candidateProfileId: id, bidderId: IsNull() },
        { bidderId: bidder.id },
      );
      await manager.update(
        Interview,
        { candidateProfileId: id, bidderId: IsNull() },
        { bidderId: bidder.id },
      );
      await manager.update(
        ActivityEvent,
        { candidateProfileId: id, bidderId: IsNull() },
        { bidderId: bidder.id },
      );
    });
    await this.audit.record('candidate_profile', id, 'assign', actor.id, {
      userId: bidder.id,
      profileId: id,
    });
    return this.toDto(await this.requireProfile(id), actor);
  }

  async update(id: number, dto: UpdateBidderProfileDto, actor: User) {
    this.assertAdmin(actor);
    const profile = await this.requireProfile(id);
    if (dto.profileName !== undefined) {
      profile.name = dto.profileName.trim();
    }
    if (dto.firstName !== undefined) {
      profile.firstName = dto.firstName.trim();
    }
    if (dto.middleName !== undefined) {
      profile.middleName = dto.middleName?.trim() || null;
    }
    if (dto.lastName !== undefined) {
      profile.lastName = dto.lastName.trim();
    }
    if (dto.email !== undefined) {
      profile.email = dto.email.trim().toLowerCase();
    }
    if (dto.phoneNumber !== undefined) {
      profile.phoneNumber = dto.phoneNumber.trim();
      profile.phone = dto.phoneNumber.trim();
    }
    if (dto.gender !== undefined) {
      profile.gender = dto.gender?.trim() || null;
    }
    if (dto.dateOfBirth !== undefined) {
      profile.dateOfBirth = dto.dateOfBirth || null;
    }
    if (dto.streetAddress !== undefined) {
      profile.streetAddress = dto.streetAddress?.trim() || null;
      profile.address = dto.streetAddress?.trim() || null;
    }
    if (dto.city !== undefined) {
      profile.city = dto.city?.trim() || null;
    }
    if (dto.stateRegion !== undefined) {
      profile.stateRegion = dto.stateRegion?.trim() || null;
    }
    if (dto.zipPostalCode !== undefined) {
      profile.zipPostalCode = dto.zipPostalCode?.trim() || null;
    }
    if (dto.linkedinUrl !== undefined) {
      profile.linkedinUrl = dto.linkedinUrl?.trim() || null;
    }
    if (dto.githubUrl !== undefined) {
      profile.githubUrl = dto.githubUrl?.trim() || null;
    }
    if (dto.portfolioUrl !== undefined) {
      profile.portfolioUrl = dto.portfolioUrl?.trim() || null;
    }
    if (dto.raceEthnicity !== undefined) {
      profile.raceEthnicity = dto.raceEthnicity?.trim() || null;
    }
    if (dto.veteranStatus !== undefined) {
      profile.veteranStatus = dto.veteranStatus?.trim() || null;
    }
    if (dto.disabilityStatus !== undefined) {
      profile.disabilityStatus = dto.disabilityStatus?.trim() || null;
    }
    if (profile.firstName && profile.lastName) {
      profile.contactName = `${profile.firstName} ${profile.lastName}`;
    }
    await this.profiles.save(profile);
    await this.audit.record('candidate_profile', id, 'update', actor.id, {
      profileId: id,
    });
    return this.toDto(await this.requireProfile(id), actor);
  }

  async remove(id: number, actor: User): Promise<void> {
    this.assertAdmin(actor);
    const profile = await this.requireProfile(id);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(JobApplication, { candidateProfileId: id });
      await manager.remove(profile);
    });
    await this.audit.record('candidate_profile', id, 'delete', actor.id, {
      profileId: id,
    });
  }

  async addExperience(profileId: number, dto: CreateWorkExperienceDto, actor: User) {
    this.assertAdmin(actor);
    await this.requireProfile(profileId);
    const currentlyWorksHere = dto.currentlyWorksHere === true;
    const endDate = currentlyWorksHere ? null : dto.endDate || null;
    const max = await this.experiences
      .createQueryBuilder('row')
      .select('MAX(row.sortOrder)', 'max')
      .where('row.candidateProfileId = :profileId', { profileId })
      .getRawOne<{ max: string | null }>();
    await this.experiences.save(
      this.experiences.create({
        candidateProfileId: profileId,
        companyName: dto.companyName.trim(),
        industry: dto.industry?.trim() || null,
        city: dto.city?.trim() || null,
        state: dto.state?.trim() || null,
        startDate: dto.startDate,
        endDate,
        currentlyWorksHere,
        sortOrder: Number(max?.max ?? 0) + 1,
      }),
    );
    return this.toDto(await this.requireProfile(profileId), actor);
  }

  async updateExperience(
    profileId: number,
    experienceId: number,
    dto: UpdateWorkExperienceDto,
    actor: User,
  ) {
    this.assertAdmin(actor);
    const row = await this.experiences.findOne({
      where: { id: experienceId, candidateProfileId: profileId },
    });
    if (!row) {
      throw new NotFoundException('Work experience not found');
    }
    if (dto.companyName !== undefined) {
      row.companyName = dto.companyName.trim();
    }
    if (dto.industry !== undefined) {
      row.industry = dto.industry?.trim() || null;
    }
    if (dto.city !== undefined) {
      row.city = dto.city?.trim() || null;
    }
    if (dto.state !== undefined) {
      row.state = dto.state?.trim() || null;
    }
    if (dto.startDate !== undefined) {
      row.startDate = dto.startDate;
    }
    if (dto.currentlyWorksHere !== undefined) {
      row.currentlyWorksHere = dto.currentlyWorksHere;
    }
    if (dto.endDate !== undefined) {
      row.endDate = dto.endDate || null;
    }
    if (row.currentlyWorksHere) {
      row.endDate = null;
    }
    await this.experiences.save(row);
    return this.toDto(await this.requireProfile(profileId), actor);
  }

  async removeExperience(profileId: number, experienceId: number, actor: User) {
    this.assertAdmin(actor);
    const row = await this.experiences.findOne({
      where: { id: experienceId, candidateProfileId: profileId },
    });
    if (!row) {
      throw new NotFoundException('Work experience not found');
    }
    await this.experiences.remove(row);
    return this.toDto(await this.requireProfile(profileId), actor);
  }

  async addEducation(profileId: number, dto: CreateEducationDto, actor: User) {
    this.assertAdmin(actor);
    await this.requireProfile(profileId);
    const max = await this.educations
      .createQueryBuilder('row')
      .select('MAX(row.sortOrder)', 'max')
      .where('row.candidateProfileId = :profileId', { profileId })
      .getRawOne<{ max: string | null }>();
    await this.educations.save(
      this.educations.create({
        candidateProfileId: profileId,
        institutionName: dto.institutionName.trim(),
        degree: dto.degree?.trim() || null,
        fromDate: dto.fromDate || null,
        toDate: dto.toDate || null,
        sortOrder: Number(max?.max ?? 0) + 1,
      }),
    );
    return this.toDto(await this.requireProfile(profileId), actor);
  }

  async updateEducation(
    profileId: number,
    educationId: number,
    dto: UpdateEducationDto,
    actor: User,
  ) {
    this.assertAdmin(actor);
    const row = await this.educations.findOne({
      where: { id: educationId, candidateProfileId: profileId },
    });
    if (!row) {
      throw new NotFoundException('Education record not found');
    }
    if (dto.institutionName !== undefined) {
      row.institutionName = dto.institutionName.trim();
    }
    if (dto.degree !== undefined) {
      row.degree = dto.degree?.trim() || null;
    }
    if (dto.fromDate !== undefined) {
      row.fromDate = dto.fromDate || null;
    }
    if (dto.toDate !== undefined) {
      row.toDate = dto.toDate || null;
    }
    await this.educations.save(row);
    return this.toDto(await this.requireProfile(profileId), actor);
  }

  async removeEducation(profileId: number, educationId: number, actor: User) {
    this.assertAdmin(actor);
    const row = await this.educations.findOne({
      where: { id: educationId, candidateProfileId: profileId },
    });
    if (!row) {
      throw new NotFoundException('Education record not found');
    }
    await this.educations.remove(row);
    return this.toDto(await this.requireProfile(profileId), actor);
  }

  private includeSensitive(actor: User, profile: BidderProfile): boolean {
    if (actor.role === UserRole.ADMIN) {
      return true;
    }
    if (isBidder(actor) && profile.assignedBidderId === actor.id) {
      return true;
    }
    return false;
  }

  private async toDto(profile: BidderProfile, actor: User) {
      const assigned = profile.assignedBidder
      ? {
          id: profile.assignedBidder.id,
          name: profile.assignedBidder.name,
          email: profile.assignedBidder.email,
          avatarUrl: avatarPublicUrl(profile.assignedBidder.avatarPath),
        }
      : null;
    return toCandidateDto(profile, {
      includeSensitive: this.includeSensitive(actor, profile),
      assignedUser: assigned,
    });
  }

  private async requireProfile(id: number): Promise<BidderProfile> {
    const profile = await this.profiles.findOne({
      where: { id },
      relations: PROFILE_RELATIONS,
    });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }
    return profile;
  }

  private assertAdmin(actor: User) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can change candidate profiles');
    }
  }

  private assertCanAccess(profile: BidderProfile, actor: User): void {
    if (isStaff(actor)) {
      return;
    }
    if (isBidder(actor) && profile.assignedBidderId === actor.id) {
      return;
    }
    throw new ForbiddenException('You cannot access this profile');
  }
}
