import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { UsersService } from '../users/users.service';
import { CallerProfile } from './caller-profile.entity';
import { CallerProfileScope, fullProfileName } from './caller.rules';

export type CallerProfileDto = {
  id: number;
  profileName: string;
  fullName: string;
  email: string | null;
  status: string;
  assignedAt: string | null;
};

export type CallerProfileDetailDto = CallerProfileDto & {
  phone: string | null;
  location: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  experiences: Array<{
    companyName: string;
    role: string | null;
    location: string | null;
    startDate: string;
    endDate: string | null;
    current: boolean;
  }>;
  educations: Array<{
    institutionName: string;
    degree: string | null;
    fromDate: string | null;
    toDate: string | null;
  }>;
};

export type CallerDto = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  avatarUrl: string | null;
  profiles: CallerProfileDto[];
};

export type AssignableProfileDto = Omit<CallerProfileDto, 'assignedAt'> & {
  callerIds: number[];
};

@Injectable()
export class CallersService {
  constructor(
    @InjectRepository(CallerProfile)
    private readonly links: Repository<CallerProfile>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  async listCallers(): Promise<CallerDto[]> {
    const [callers, links, profiles] = await Promise.all([
      this.users
        .createQueryBuilder('user')
        .where(':role = ANY(user.roles)', { role: UserRole.CALLER })
        .orderBy('user.name', 'ASC')
        .getMany(),
      this.links.find(),
      this.profiles.find({ order: { name: 'ASC' } }),
    ]);
    const byId = new Map(profiles.map((row) => [row.id, row]));
    return callers.map((caller) => {
      const own = links.filter((link) => link.callerId === caller.id);
      return {
        ...this.callerFields(caller),
        profiles: own
          .map((link) => {
            const profile = byId.get(link.profileId);
            return profile ? toProfileDto(profile, link.assignedAt) : null;
          })
          .filter((row): row is CallerProfileDto => row !== null)
          .sort((left, right) => left.profileName.localeCompare(right.profileName)),
      };
    });
  }

  async listAssignableProfiles(): Promise<AssignableProfileDto[]> {
    const [profiles, links] = await Promise.all([
      this.profiles.find({ order: { name: 'ASC' } }),
      this.links.find(),
    ]);
    return profiles.map((profile) => {
      const { assignedAt: _assignedAt, ...rest } = toProfileDto(profile, null);
      return {
        ...rest,
        callerIds: links
          .filter((link) => link.profileId === profile.id)
          .map((link) => link.callerId),
      };
    });
  }

  async setProfiles(callerId: number, profileIds: number[], actor: User) {
    const caller = await this.users.findOne({ where: { id: callerId } });
    if (!caller) {
      throw new NotFoundException('Caller not found.');
    }
    if (caller.role !== UserRole.CALLER) {
      throw new BadRequestException('Profiles can only be assigned to callers.');
    }
    const wanted = [...new Set(profileIds)];
    if (wanted.length > 0) {
      const found = await this.profiles.count({ where: { id: In(wanted) } });
      if (found !== wanted.length) {
        throw new BadRequestException('One or more profiles no longer exist.');
      }
    }
    const current = await this.links.find({ where: { callerId } });
    const keep = new Set(wanted);
    const removed = current.filter((link) => !keep.has(link.profileId));
    const existing = new Set(current.map((link) => link.profileId));
    const added = wanted.filter((id) => !existing.has(id));
    if (removed.length > 0) {
      await this.links.delete({
        callerId,
        profileId: In(removed.map((link) => link.profileId)),
      });
    }
    if (added.length > 0) {
      await this.links.save(
        added.map((profileId) =>
          this.links.create({ callerId, profileId, assignedById: actor.id }),
        ),
      );
    }
    const updated = (await this.listCallers()).find((row) => row.id === callerId);
    if (!updated) {
      throw new NotFoundException('Caller not found.');
    }
    return updated;
  }

  async mine(actor: User): Promise<
    Omit<CallerDto, 'profiles'> & { profiles: CallerProfileDetailDto[] }
  > {
    const links = await this.links.find({ where: { callerId: actor.id } });
    const profiles = links.length
      ? await this.profiles.find({
          where: { id: In(links.map((link) => link.profileId)) },
          relations: { experiences: true, educations: true },
        })
      : [];
    const assignedAt = new Map(links.map((link) => [link.profileId, link.assignedAt]));
    return {
      ...this.callerFields(actor),
      profiles: profiles
        .map((profile) => toProfileDetailDto(profile, assignedAt.get(profile.id) ?? null))
        .sort((left, right) => left.profileName.localeCompare(right.profileName)),
    };
  }

  /** Profiles a caller may see schedules and applications for. */
  async scopeFor(callerId: number): Promise<CallerProfileScope[]> {
    const links = await this.links.find({ where: { callerId } });
    if (links.length === 0) {
      return [];
    }
    const profiles = await this.profiles.find({
      where: { id: In(links.map((link) => link.profileId)) },
    });
    return profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      fullName: fullProfileName(profile),
      email: profile.email,
    }));
  }

  private callerFields(user: User) {
    const pub = this.usersService.toPublicUser(user) as {
      avatarUrl?: string | null;
    };
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive !== false,
      avatarUrl: pub.avatarUrl ?? null,
    };
  }
}

function joinParts(...parts: Array<string | null | undefined>) {
  return parts.map((part) => (part ?? '').trim()).filter(Boolean).join(', ') || null;
}

/** What a caller needs to speak as the profile; no DOB, street address, or demographics. */
function toProfileDetailDto(
  profile: BidderProfile,
  assignedAt: Date | null,
): CallerProfileDetailDto {
  const newestFirst = (left: string | null, right: string | null) =>
    (right ?? '').localeCompare(left ?? '');
  return {
    ...toProfileDto(profile, assignedAt),
    phone: profile.phoneNumber?.trim() || profile.phone?.trim() || null,
    location: joinParts(profile.city, profile.stateRegion),
    linkedinUrl: profile.linkedinUrl,
    githubUrl: profile.githubUrl,
    portfolioUrl: profile.portfolioUrl,
    experiences: [...(profile.experiences ?? [])]
      .sort(
        (left, right) =>
          Number(right.currentlyWorksHere) - Number(left.currentlyWorksHere) ||
          newestFirst(left.startDate, right.startDate),
      )
      .map((row) => ({
        companyName: row.companyName,
        role: row.industry,
        location: joinParts(row.city, row.state),
        startDate: row.startDate,
        endDate: row.endDate,
        current: row.currentlyWorksHere,
      })),
    educations: [...(profile.educations ?? [])]
      .sort((left, right) => newestFirst(left.fromDate, right.fromDate))
      .map((row) => ({
        institutionName: row.institutionName,
        degree: row.degree,
        fromDate: row.fromDate,
        toDate: row.toDate,
      })),
  };
}

function toProfileDto(profile: BidderProfile, assignedAt: Date | null): CallerProfileDto {
  return {
    id: profile.id,
    profileName: profile.name,
    fullName: fullProfileName(profile),
    email: profile.email,
    status: profile.status,
    assignedAt: assignedAt ? assignedAt.toISOString() : null,
  };
}
