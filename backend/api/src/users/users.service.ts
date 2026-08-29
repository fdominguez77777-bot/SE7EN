import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
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
  ) {}

  toPublicUser(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      bidderProfileId: user.bidderProfileId ?? null,
      created_at: user.created_at,
    };
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

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { id: 'ASC' },
    });
  }

  async createFromAdmin(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.create(dto);
    return this.toPublicUser(user);
  }

  async assignBidderProfile(userId: number, bidderProfileId: number): Promise<void> {
    await this.usersRepository.update(userId, { bidderProfileId });
  }

  async attachBidderProfile(
    userId: number,
    bidderProfileId: number,
  ): Promise<UserResponseDto> {
    const user = await this.findByIdOrFail(userId);
    if (user.role !== UserRole.BIDDER) {
      throw new BadRequestException('Only BIDDER accounts can be linked to a profile');
    }
    const profile = await this.profiles.findOne({
      where: { id: bidderProfileId },
    });
    if (!profile) {
      throw new NotFoundException('Bidder profile not found');
    }
    const taken = await this.usersRepository.findOne({
      where: { bidderProfileId },
    });
    if (taken && taken.id !== userId) {
      throw new ConflictException('This bidder profile is already linked to another user');
    }
    user.bidderProfileId = bidderProfileId;
    await this.usersRepository.save(user);
    return this.toPublicUser(user);
  }
}
