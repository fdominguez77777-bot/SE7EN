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
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { ActivityService } from './activity.service';
import { CreateActivityAdjustmentDto } from './dto/create-activity-adjustment.dto';

function defaultRange(): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

@ApiTags('activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Activity counts by candidate for a period' })
  summary(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const range = defaultRange();
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
