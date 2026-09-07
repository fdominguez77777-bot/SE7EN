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
import { DAILY_SUBMISSION_STAFF_ROLES } from './daily-submission.rules';
import { SaveDailySubmissionDto } from './dto/daily-submission.dto';
import { DailySubmissionsService } from './daily-submissions.service';

@ApiTags('daily-submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('daily-submissions')
export class DailySubmissionsController {
  constructor(private readonly dailySubmissions: DailySubmissionsService) {}

  @Get()
  @Roles(...DAILY_SUBMISSION_STAFF_ROLES)
  @ApiOperation({ summary: 'List daily submissions (staff)' })
  list(@CurrentUser() actor: User, @Query('date') date?: string) {
    return this.dailySubmissions.list(actor, date);
  }

  @Get('workspace')
  @Roles(...DAILY_SUBMISSION_STAFF_ROLES)
  @ApiOperation({ summary: 'Get or create the manager workspace for a date' })
  workspace(@CurrentUser() actor: User, @Query('date') date?: string) {
    return this.dailySubmissions.workspace(actor, date);
  }

  @Get('unread-count')
  @Roles(...DAILY_SUBMISSION_STAFF_ROLES)
  @ApiOperation({ summary: 'Unread daily report count for the current user' })
  unreadCount(@CurrentUser() actor: User) {
    return this.dailySubmissions.unreadCount(actor);
  }

  @Post('seen')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark all daily reports as seen by the current admin' })
  markSeen(@CurrentUser() actor: User) {
    return this.dailySubmissions.markInboxSeen(actor);
  }

  @Get(':id')
  @Roles(...DAILY_SUBMISSION_STAFF_ROLES)
  @ApiOperation({ summary: 'Get a daily submission' })
  getOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.dailySubmissions.getOne(id, actor);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Save a daily submission (staff)' })
  save(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveDailySubmissionDto,
    @CurrentUser() actor: User,
  ) {
    return this.dailySubmissions.saveDraft(id, dto, actor);
  }

  @Post(':id/submit')
  @Roles(UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Submit a daily report (BID_MANAGER)' })
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.dailySubmissions.submit(id, actor);
  }

  @Post(':id/reopen')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Return a daily report to draft (ADMIN)' })
  reopen(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.dailySubmissions.reopen(id, actor);
  }

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a daily report (ADMIN)' })
  review(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.dailySubmissions.review(id, actor);
  }
}
