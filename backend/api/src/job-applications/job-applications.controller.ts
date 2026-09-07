import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { TalynBulkSyncDto, TalynSyncDto } from './dto/talyn-sync.dto';
import { UpdateJobApplicationDto } from './dto/update-job-application.dto';
import { JobApplicationsService } from './job-applications.service';
import { TalynSyncService } from './talyn-sync.service';

@ApiTags('job-applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
@Controller('job-applications')
export class JobApplicationsController {
  constructor(
    private readonly jobApplicationsService: JobApplicationsService,
    private readonly talynSync: TalynSyncService,
  ) {}

  @Post('sync')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN Talyn upsert for one application' })
  async syncOne(@Body() dto: TalynSyncDto, @CurrentUser() user: User) {
    const result = await this.talynSync.syncOne(dto, user.id);
    return {
      created: result.status === 'CREATED',
      status: result.status,
      application: result.application,
    };
  }

  @Post('sync/bulk')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN bulk Talyn upsert (max 100)' })
  syncBulk(@Body() dto: TalynBulkSyncDto, @CurrentUser() user: User) {
    return this.talynSync.syncBulk(dto, user.id);
  }

  @Post('sync/validate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ADMIN dry-run Talyn payload validation' })
  validate(@Body() dto: TalynSyncDto) {
    return this.talynSync.validate(dto);
  }

  @Get('integration')
  @ApiOperation({ summary: 'Talyn integration status' })
  integration() {
    return this.jobApplicationsService.integrationStatus();
  }

  @Get()
  @ApiOperation({
    summary: 'List job application records',
    description:
      'ADMIN and BID_MANAGER see all applications. BIDDER sees applications assigned to them.',
  })
  findAll(
    @CurrentUser() user: User,
    @Query('candidateProfileId') candidateProfileId?: string,
    @Query('candidateId') candidateId?: string,
    @Query('bidderId') bidderId?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const candidate = parsePositiveInt(candidateProfileId || candidateId);
    const bidder = parsePositiveInt(bidderId);
    return this.jobApplicationsService.findAll(user, {
      candidateProfileId: candidate,
      bidderId: bidder,
      status,
      source,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job application including JD and resume' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.jobApplicationsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update application fields. Does not create another activity event.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobApplicationDto,
    @CurrentUser() user: User,
  ) {
    return this.jobApplicationsService.update(id, dto, user);
  }
}

function parsePositiveInt(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
