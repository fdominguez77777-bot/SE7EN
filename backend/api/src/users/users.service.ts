import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { BidInvitation } from '../bid-invitations/bid-invitation.entity';
import { BidSubmission } from '../bid-submissions/bid-submission.entity';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { assignmentRejectedReason } from '../bidder-profiles/assignment.rules';
import { BidManagerCompensation } from '../compensation/bid-manager-compensation.entity';
import { BidManagerWeeklyPayment } from '../compensation/bid-manager-weekly-payment.entity';
import { BidderIndividualCompensationRate } from '../compensation/bidder-individual-compensation-rate.entity';
import { BidderWeeklyPayment } from '../compensation/bidder-weekly-payment.entity';
import { DailySubmissionBidder } from '../daily-submissions/daily-submission-bidder.entity';
import { Interview } from '../interviews/interview.entity';
import { JobApplication } from '../job-applications/job-application.entity';
import { Project } from '../projects/project.entity';
import {
  AVATAR_MAX_BYTES,
  detectImageKind,
} from '../storage/image-kind';
import { FileStorageService } from '../storage/file-storage.service';
import { WeeklyInvoiceBidder } from '../weekly-invoices/weekly-invoice-bidder.entity';
import { WeeklyInvoiceDailyBidder } from '../weekly-invoices/weekly-invoice-daily-bidder.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { MemberDetailDto, UserResponseDto } from './dto/user-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  DEFAULT_MEMBER_PASSWORD,
  deleteBlock,
  publicUserFields,
  roleChangeBlockReason,
  statusChangeBlockReason,
} from './member-admin.rules';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';

const BCRYPT_ROUNDS = 10;

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(BidderProfile)
    private readonly profiles: Repository<BidderProfile>,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
    private readonly files: FileStorageService,
  ) {}

  toPublicUser(user: User): UserResponseDto {
    return publicUserFields(user);
  }

  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(input: CreateUserInput): Promise<User> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const user = this.usersRepository.create({
      name: input.name.trim(),
      email,
      password: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role: input.role,
      isActive: true,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByIdOrFail(id: number): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** @deprecated Unused. Assignment uses BidderProfile.assignedBidderId. */
  async findByBidderProfileId(bidderProfileId: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { bidderProfileId },
    });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findBidders(): Promise<User[]> {
    return this.usersRepository.find({
      where: { role: UserRole.BIDDER },
      order: { name: 'ASC' },
    });
  }

  async findCalendarPeople(): Promise<User[]> {
    return this.usersRepository.find({
      where: [
        { role: UserRole.ADMIN, isActive: true },
        { role: UserRole.BID_MANAGER, isActive: true },
        { role: UserRole.BIDDER, isActive: true },
      ],
      order: { name: 'ASC' },
    });
  }

  async findManagers(): Promise<User[]> {
    return this.usersRepository.find({
      where: { role: UserRole.BID_MANAGER },
      order: { name: 'ASC' },
    });
  }

  async createFromAdmin(dto: CreateUserDto): Promise<UserResponseDto> {
    const password = dto.useDefaultPassword
      ? DEFAULT_MEMBER_PASSWORD
      : dto.password;
    if (!password) {
      throw new BadRequestException(
        'Provide a password or use the default password.',
      );
    }
    const user = await this.create({
      name: dto.name,
      email: dto.email,
      password,
      role: dto.role,
    });
    return this.toPublicUser(user);
  }

  async getMember(id: number): Promise<MemberDetailDto> {
    const user = await this.findByIdOrFail(id);
    const assignedProfileCount = await this.profiles.count({
      where: { assignedBidderId: id },
    });
    return {
      ...this.toPublicUser(user),
      assignedProfileCount,
    };
  }

  async updateMember(
    id: number,
    dto: UpdateUserDto,
    actor: User,
  ): Promise<UserResponseDto> {
    const user = await this.findByIdOrFail(id);

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      const existing = await this.findByEmail(email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
      user.email = email;
    }

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }

    if (dto.role !== undefined && dto.role !== user.role) {
      const [activeAdminCount, assignedCandidateCount] = await Promise.all([
        this.countActiveAdmins(),
        this.profiles.count({ where: { assignedBidderId: id } }),
      ]);
      const reason = roleChangeBlockReason({
        actorId: actor.id,
        targetId: user.id,
        currentRole: user.role,
        nextRole: dto.role,
        activeAdminCount,
        assignedCandidateCount,
      });
      if (reason) {
        throw new BadRequestException(reason);
      }
      user.role = dto.role;
    }

    if (dto.isActive !== undefined && dto.isActive !== (user.isActive !== false)) {
      const activeAdminCount = await this.countActiveAdmins();
      const reason = statusChangeBlockReason({
        actorId: actor.id,
        targetId: user.id,
        targetRole: user.role,
        nextIsActive: dto.isActive,
        currentlyActive: user.isActive !== false,
        activeAdminCount,
      });
      if (reason) {
        throw new BadRequestException(reason);
      }
      user.isActive = dto.isActive;
    }

    const saved = await this.usersRepository.save(user);
    await this.audit.record('user', id, 'update', actor.id, {
      role: saved.role,
      isActive: saved.isActive,
    });
    return this.toPublicUser(saved);
  }

  async resetPassword(
    id: number,
    dto: ResetPasswordDto,
    actor: User,
  ): Promise<{ message: string }> {
    await this.findByIdOrFail(id);
    const plain =
      dto.useDefault === true ? DEFAULT_MEMBER_PASSWORD : dto.newPassword;
    if (!plain) {
      throw new BadRequestException(
        'Provide a new password or use the default password.',
      );
    }
    const password = await bcrypt.hash(plain, BCRYPT_ROUNDS);
    await this.usersRepository.update(id, { password });
    await this.audit.record('user', id, 'reset_password', actor.id, {
      userId: id,
      usedDefault: dto.useDefault === true,
    });
    return { message: 'Password reset successfully.' };
  }

  async countActiveAdmins(): Promise<number> {
    return this.usersRepository.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });
  }

  /** @deprecated Prefer PATCH /bidder-profiles/:id/assignment. Writes assignedBidderId only. */
  async assignBidderProfile(userId: number, bidderProfileId: number): Promise<void> {
    await this.profiles.update(bidderProfileId, { assignedBidderId: userId });
  }

  /** @deprecated Prefer PATCH /bidder-profiles/:id/assignment. Writes assignedBidderId only. */
  async attachBidderProfile(
    userId: number,
    bidderProfileId: number,
    actor: User,
  ): Promise<UserResponseDto> {
    const user = await this.findByIdOrFail(userId);
    const rejected = assignmentRejectedReason(user);
    if (rejected) {
      throw new BadRequestException(rejected);
    }
    const profile = await this.profiles.findOne({
      where: { id: bidderProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Bidder profile not found');
    }
    profile.assignedBidderId = userId;
    await this.profiles.save(profile);
    await this.audit.record('candidate_profile', bidderProfileId, 'assign', actor.id, {
      userId,
      profileId: bidderProfileId,
    });
    return this.toPublicUser(user);
  }

  async removeMember(id: number, actor: User): Promise<void> {
    const user = await this.findByIdOrFail(id);
    const [activeAdminCount, hasManagerHistory] = await Promise.all([
      this.countActiveAdmins(),
      this.hasManagerHistory(id),
    ]);

    const blocked = deleteBlock({
      actorId: actor.id,
      targetId: user.id,
      targetRole: user.role,
      activeAdminCount,
      hasManagerHistory,
    });
    if (blocked) {
      if (blocked.conflict) {
        throw new ConflictException(blocked.message);
      }
      throw new BadRequestException(blocked.message);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        BidderProfile,
        { assignedBidderId: id },
        { assignedBidderId: null },
      );
      await manager.update(
        JobApplication,
        { bidderId: id },
        { bidderId: null },
      );
      await manager.update(
        JobApplication,
        { createdByUserId: id },
        { createdByUserId: null },
      );
      await manager.update(Interview, { createdById: id }, { createdById: actor.id });
      await manager.update(Project, { createdById: id }, { createdById: actor.id });
      await manager.update(
        BidInvitation,
        { invitedById: id },
        { invitedById: actor.id },
      );
      await manager.update(
        BidSubmission,
        { createdById: id },
        { createdById: actor.id },
      );
      await manager.delete(DailySubmissionBidder, { bidderId: id });
      await manager.delete(WeeklyInvoiceBidder, { bidderId: id });
      await manager.delete(WeeklyInvoiceDailyBidder, { bidderId: id });
      await manager.delete(BidderIndividualCompensationRate, { bidderId: id });
      await manager.delete(BidderWeeklyPayment, { bidderId: id });
      await manager.remove(user);
    });
    await this.audit.record('user', id, 'delete', actor.id, {
      userId: id,
      role: user.role,
    });
    await this.files.delete(user.avatarPath);
  }

  /** @deprecated Use removeMember. Kept for existing BIDDER-only callers. */
  async removeBidder(id: number, actor: User): Promise<void> {
    return this.removeMember(id, actor);
  }

  async setAvatar(
    targetId: number,
    actor: User,
    file: { buffer: Buffer; size: number } | undefined,
  ): Promise<UserResponseDto> {
    this.assertCanEditAvatar(actor, targetId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a PNG, JPG, or WEBP photo.');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('Photo must be 5 MB or smaller.');
    }
    const kind = detectImageKind(file.buffer);
    if (!kind) {
      throw new BadRequestException(
        'Unsupported file type. Use PNG, JPG, or WEBP.',
      );
    }
    const user = await this.findByIdOrFail(targetId);
    const previous = user.avatarPath;
    const nextPath = `avatars/${user.id}/${randomUUID()}.${kind.ext}`;
    await this.files.put(nextPath, file.buffer);
    user.avatarPath = nextPath;
    const saved = await this.usersRepository.save(user);
    if (previous && previous !== nextPath) {
      await this.files.delete(previous);
    }
    await this.audit.record('user', user.id, 'avatar_upload', actor.id, {
      userId: user.id,
    });
    return this.toPublicUser(saved);
  }

  async clearAvatar(targetId: number, actor: User): Promise<UserResponseDto> {
    this.assertCanEditAvatar(actor, targetId);
    const user = await this.findByIdOrFail(targetId);
    const previous = user.avatarPath;
    user.avatarPath = null;
    const saved = await this.usersRepository.save(user);
    await this.files.delete(previous);
    await this.audit.record('user', user.id, 'avatar_remove', actor.id, {
      userId: user.id,
    });
    return this.toPublicUser(saved);
  }

  private assertCanEditAvatar(actor: User, targetId: number) {
    if (actor.id === targetId) {
      return;
    }
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    throw new ForbiddenException(
      'You can only change your own profile photo.',
    );
  }

  private async hasManagerHistory(id: number): Promise<boolean> {
    const [salaries, payments] = await Promise.all([
      this.dataSource
        .getRepository(BidManagerCompensation)
        .count({ where: { managerId: id } }),
      this.dataSource
        .getRepository(BidManagerWeeklyPayment)
        .count({ where: { managerId: id } }),
    ]);
    return salaries + payments > 0;
  }
}
