import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { BidderProfile } from '../bidder-profiles/bidder-profile.entity';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { FileStorageService } from '../storage/file-storage.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BidderProfile),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: { put: jest.fn(), delete: jest.fn(), resolveKey: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
