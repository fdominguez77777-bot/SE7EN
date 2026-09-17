import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { mondaySundayWeek } from '../reporting/week-range';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { ActivityService } from './activity.service';
import { CreateActivityAdjustmentDto } from './dto/create-activity-adjustment.dto';

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('events')
  @ApiOperation({ summary: 'Activity adjustment events for a period' })
  events(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('candidateProfileId') candidateProfileId?: string,
  ) {
    const range = mondaySundayWeek();
    const profileId = candidateProfileId
      ? Number(candidateProfileId)
      : undefined;
    return this.activityService.listEvents(
      user,
      from ? new Date(from) : range.from,
      to ? new Date(to) : range.to,
      profileId && Number.isFinite(profileId) ? profileId : undefined,
    );
  }

  @Get('summary/bidders')
  @ApiOperation({ summary: 'Activity counts by attributed bidder for a period' })
  summaryByBidder(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = mondaySundayWeek();
    return this.activityService.summarizeByBidder(
      user,
      from ? new Date(from) : range.from,
      to ? new Date(to) : range.to,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Activity counts by candidate for a period' })
  summary(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = mondaySundayWeek();
    return this.activityService.summarize(
      user,
      from ? new Date(from) : range.from,
      to ? new Date(to) : range.to,
    );
  }

  @Post('adjustments')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Manually add or correct activity counts' })
  adjust(
    @Body() dto: CreateActivityAdjustmentDto,
    @CurrentUser() user: User,
  ) {
    return this.activityService.adjust(dto, user);
  }
}
