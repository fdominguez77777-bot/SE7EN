import {
  Body,
  Controller,
  Delete,
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
import { CalendarProvider } from './calendar.rules';
import { CalendarService } from './calendar.service';
import { AssignCalendarBidderDto, CreateCalendarLinkDto } from './dto/calendar.dto';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('accounts')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Connected Google and Microsoft calendars' })
  listAccounts() {
    return this.calendar.listAccounts();
  }

  @Get('bidders')
  @ApiOperation({ summary: 'Bidders with assigned calendar accounts' })
  listBidders(@CurrentUser() user: User) {
    return this.calendar.listBidders(user);
  }

  @Get('events')
  @ApiOperation({ summary: 'Interview events from connected calendars' })
  listEvents(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.listEvents(from || '', to || '', user);
  }

  @Post('accounts/google/link')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a Google Calendar connect link' })
  createGoogleLink(
    @CurrentUser() user: User,
    @Body() body: CreateCalendarLinkDto = {},
  ) {
    return this.calendar.createConnectLink(
      CalendarProvider.GOOGLE,
      user.id,
      body.assignedBidderId,
    );
  }

  @Post('accounts/microsoft/link')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a Microsoft Calendar connect link' })
  createMicrosoftLink(
    @CurrentUser() user: User,
    @Body() body: CreateCalendarLinkDto = {},
  ) {
    return this.calendar.createConnectLink(
      CalendarProvider.MICROSOFT,
      user.id,
      body.assignedBidderId,
    );
  }

  @Patch('accounts/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a connected calendar to a bidder' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignCalendarBidderDto,
  ) {
    return this.calendar.assignBidder(id, body.assignedBidderId ?? null);
  }

  @Post('accounts/reset')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Disconnect every calendar' })
  reset() {
    return this.calendar.resetAll();
  }

  @Delete('accounts/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Disconnect one calendar' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.calendar.removeAccount(id);
  }
}
