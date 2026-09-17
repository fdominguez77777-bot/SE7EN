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
import { SaveWeeklyInvoiceDto } from './dto/weekly-invoice.dto';
import { WEEKLY_INVOICE_STAFF_ROLES } from './weekly-invoice.rules';
import { WeeklyInvoicesService } from './weekly-invoices.service';

@ApiTags('weekly-invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('weekly-invoices')
export class WeeklyInvoicesController {
  constructor(private readonly weeklyInvoices: WeeklyInvoicesService) {}

  @Get()
  @Roles(...WEEKLY_INVOICE_STAFF_ROLES)
  @ApiOperation({ summary: 'List weekly invoices (staff)' })
  list(@CurrentUser() actor: User, @Query('weekStart') weekStart?: string) {
    return this.weeklyInvoices.list(actor, weekStart);
  }

  @Get('workspace')
  @Roles(...WEEKLY_INVOICE_STAFF_ROLES)
  @ApiOperation({ summary: 'Get or create the manager weekly invoice workspace' })
  workspace(
    @CurrentUser() actor: User,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.weeklyInvoices.workspace(actor, weekStart);
  }

  @Get(':id')
  @Roles(...WEEKLY_INVOICE_STAFF_ROLES)
  @ApiOperation({ summary: 'Get a weekly invoice' })
  getOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.getOne(id, actor);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Save a weekly invoice (staff)' })
  save(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveWeeklyInvoiceDto,
    @CurrentUser() actor: User,
  ) {
    return this.weeklyInvoices.saveDraft(id, dto, actor);
  }

  @Post(':id/refresh-defaults')
  @Roles(UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Refresh default counts from Daily Submissions' })
  refresh(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.refreshDefaults(id, actor);
  }

  @Post(':id/reset-counts')
  @Roles(UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Reset invoice counts to Daily Submission defaults' })
  resetCounts(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.resetCounts(id, actor);
  }

  @Post(':id/submit')
  @Roles(UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Submit a weekly invoice (BID_MANAGER)' })
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.submit(id, actor);
  }

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a weekly invoice reviewed (ADMIN)' })
  review(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.review(id, actor);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a weekly invoice (ADMIN)' })
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.approve(id, actor);
  }

  @Post(':id/reopen')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Return a weekly invoice to draft (ADMIN)' })
  reopen(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.weeklyInvoices.reopen(id, actor);
  }
}
