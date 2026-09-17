import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user-role.enum';
import { BidderProfilesService } from './bidder-profiles.service';
import { BidderProfile } from './bidder-profile.entity';
import { Education } from './education.entity';
import { WorkExperience } from './work-experience.entity';

describe('BidderProfilesService assignment', () => {
  let service: BidderProfilesService;
  const profiles = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const usersService = {
    findByIdOrFail: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const manager = {
    save: jest.fn(async (row: unknown) => row),
    update: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  };

  const admin = { id: 1, role: UserRole.ADMIN } as never;
  const bidderA = { id: 10, role: UserRole.BIDDER, name: 'A', email: 'a@x' };
  const bidderB = { id: 11, role: UserRole.BIDDER, name: 'B', email: 'b@x' };

  function profileRow(id: number, assignedBidderId: number | null, assignedBidder: typeof bidderA | null) {
    return {
      id,
      name: `P${id}`,
      assignedBidderId,
      assignedBidder,
      experiences: [],
      educations: [],
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BidderProfilesService,
        { provide: getRepositoryToken(BidderProfile), useValue: profiles },
        { provide: getRepositoryToken(WorkExperience), useValue: {} },
        { provide: getRepositoryToken(Education), useValue: {} },
        { provide: UsersService, useValue: usersService },
        { provide: AuditService, useValue: audit },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(BidderProfilesService);
  });

  it('assigns two candidates to the same bidder', async () => {
    usersService.findByIdOrFail.mockResolvedValue(bidderA);
    profiles.findOne
      .mockResolvedValueOnce(profileRow(1, null, null))
      .mockResolvedValueOnce(profileRow(1, 10, bidderA))
      .mockResolvedValueOnce(profileRow(2, null, null))
      .mockResolvedValueOnce(profileRow(2, 10, bidderA));
    profiles.save.mockImplementation(async (row: { assignedBidderId: number }) => row);

    const first = await service.assignBidder(1, 10, admin);
    const second = await service.assignBidder(2, 10, admin);
    expect(first.assignedBidderId).toBe(10);
    expect(second.assignedBidderId).toBe(10);
    expect(manager.save).toHaveBeenCalledTimes(2);
  });

  it('reassigns a candidate and unassigns', async () => {
    usersService.findByIdOrFail.mockResolvedValue(bidderB);
    profiles.findOne
      .mockResolvedValueOnce(profileRow(1, 10, bidderA))
      .mockResolvedValueOnce(profileRow(1, 11, bidderB))
      .mockResolvedValueOnce(profileRow(1, 11, bidderB))
      .mockResolvedValueOnce(profileRow(1, null, null));
    profiles.save.mockImplementation(async (row: unknown) => row);

    const reassigned = await service.assignBidder(1, 11, admin);
    expect(reassigned.assignedBidderId).toBe(11);

    const unassigned = await service.assignBidder(1, null, admin);
    expect(unassigned.assignedBidderId).toBeNull();
    expect(unassigned.assignedUser).toBeNull();
  });

  it('assigns a candidate to an admin and a bid manager', async () => {
    const manager = { id: 3, role: UserRole.BID_MANAGER, name: 'M', email: 'm@x' };
    usersService.findByIdOrFail
      .mockResolvedValueOnce(admin)
      .mockResolvedValueOnce(manager);
    profiles.findOne
      .mockResolvedValueOnce(profileRow(1, null, null))
      .mockResolvedValueOnce(profileRow(1, 1, admin as never))
      .mockResolvedValueOnce(profileRow(2, null, null))
      .mockResolvedValueOnce(profileRow(2, 3, manager as never));
    profiles.save.mockImplementation(async (row: { assignedBidderId: number }) => row);

    const toAdmin = await service.assignBidder(1, 1, admin);
    const toManager = await service.assignBidder(2, 3, admin);
    expect(toAdmin.assignedBidderId).toBe(1);
    expect(toManager.assignedBidderId).toBe(3);
  });

  it('rejects assigning a disabled member', async () => {
    usersService.findByIdOrFail.mockResolvedValue({
      id: 2,
      role: UserRole.ADMIN,
      isActive: false,
    });
    profiles.findOne.mockResolvedValue(profileRow(1, null, null));
    await expect(service.assignBidder(1, 2, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('scopes bidder list to assigned profiles only', async () => {
    const bidder = { id: 10, role: UserRole.BIDDER } as never;
    profiles.find.mockResolvedValue([profileRow(1, 10, bidderA)]);
    const rows = await service.findAll(bidder);
    expect(profiles.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { assignedBidderId: 10 } }),
    );
    expect(rows).toHaveLength(1);
  });

  it('forbids bidder access to another candidate', async () => {
    const bidder = { id: 10, role: UserRole.BIDDER } as never;
    profiles.findOne.mockResolvedValue(profileRow(2, 11, bidderB));
    await expect(service.findOne(2, bidder)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
