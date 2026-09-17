import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/user-role.enum';
import { JiracodersApplicationsService } from './jiracoders.service';

@ApiTags('applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
@Controller('applications')
export class JiracodersApplicationsController {
  constructor(private readonly applications: JiracodersApplicationsService) {}

  @Get('bidders')
  @ApiOperation({ summary: 'JiraCoders bidder stats for the Applications filters' })
  listBidders() {
    return this.applications.listBidders();
  }

  @Get()
  @ApiOperation({
    summary: 'List JiraCoders job applications for the Applications table',
  })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('bidderId') bidderId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('company') company?: string,
    @Query('position') position?: string,
    @Query('source') source?: string,
    @Query('statusContains') statusContains?: string,
    @Query('applied') applied?: string,
    @Query('bidderName') bidderName?: string,
  ) {
    return this.applications.list({
      page: parsePositiveInt(page),
      limit: parsePositiveInt(limit),
      keyword,
      status,
      cursor,
      bidderId: parsePositiveInt(bidderId),
      fromDate,
      toDate,
      company,
      position,
      source,
      statusContains,
      applied,
      bidderName,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'JiraCoders job application details' })
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.applications.getOne(id);
  }
}

function parsePositiveInt(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
