import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @ApiOperation({ summary: 'Role-specific activity dashboard' })
  summary(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('todayFrom') todayFrom?: string,
    @Query('todayTo') todayTo?: string,
    @Query('weekFrom') weekFrom?: string,
    @Query('weekTo') weekTo?: string,
  ) {
    return this.dashboardService.getSummary(user, {
      from,
      to,
      todayFrom,
      todayTo,
      weekFrom,
      weekTo,
    });
  }
}
