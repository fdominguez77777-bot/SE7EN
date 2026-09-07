import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { CompensationService } from './compensation.service';
import {
  CreateBidderRateDto,
  CreateManagerSalaryDto,
  EndIndividualBidderRateDto,
} from './dto/compensation.dto';

@ApiTags('compensation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compensation')
export class CompensationController {
  constructor(private readonly compensation: CompensationService) {}

  @Get('rates')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'List effective-dated default bidder compensation rates' })
  listRates(@CurrentUser() user: User) {
    return this.compensation.listRates(user);
  }

  @Get('rates/current')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Current default bidder application and interview rates' })
  currentRates(@CurrentUser() user: User) {
    return this.compensation.currentRates(user);
  }

  @Post('rates')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new bidder rate effective date (ADMIN)' })
  createRate(@Body() dto: CreateBidderRateDto, @CurrentUser() user: User) {
    return this.compensation.createRate(dto, user);
  }

  @Get('bidder-rates/:bidderId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Individual bidder rate history and resolved rates (ADMIN)' })
  getIndividualRates(
    @Param('bidderId', ParseIntPipe) bidderId: number,
    @CurrentUser() user: User,
  ) {
    return this.compensation.getIndividualBidderRates(bidderId, user);
  }

  @Post('bidder-rates/:bidderId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create an individual bidder rate (ADMIN)' })
  createIndividualRate(
    @Param('bidderId', ParseIntPipe) bidderId: number,
    @Body() dto: CreateBidderRateDto,
    @CurrentUser() user: User,
  ) {
    return this.compensation.createIndividualBidderRate(bidderId, dto, user);
  }

  @Post('bidder-rates/:bidderId/end')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'End individual override and return to default rates (ADMIN)' })
  endIndividualRate(
    @Param('bidderId', ParseIntPipe) bidderId: number,
    @Body() dto: EndIndividualBidderRateDto,
    @CurrentUser() user: User,
  ) {
    return this.compensation.endIndividualBidderRate(bidderId, dto, user);
  }

  @Get('manager-salaries')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List BID_MANAGER weekly salaries (ADMIN)' })
  listManagerSalaries(@CurrentUser() user: User) {
    return this.compensation.listManagerSalaries(user);
  }

  @Post('manager-salaries')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set a BID_MANAGER weekly salary (ADMIN)' })
  createManagerSalary(@Body() dto: CreateManagerSalaryDto, @CurrentUser() user: User) {
    return this.compensation.createManagerSalary(dto, user);
  }

  @Get('week')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
  @ApiOperation({ summary: 'Weekly payment snapshots for the reporting period' })
  week(
    @CurrentUser() user: User,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('from and to must be valid dates');
    }
    return this.compensation.week(user, start, end);
  }

  @Post('payments/bidders/:id/review')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Mark a bidder weekly payment reviewed' })
  reviewBidder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.compensation.reviewBidderPayment(id, user);
  }

  @Post('payments/bidders/:id/pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a bidder weekly payment paid' })
  payBidder(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.compensation.payBidderPayment(id, user);
  }

  @Post('payments/managers/:id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a manager weekly salary reviewed' })
  reviewManager(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.compensation.reviewManagerPayment(id, user);
  }

  @Post('payments/managers/:id/pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark a manager weekly salary paid' })
  payManager(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.compensation.payManagerPayment(id, user);
  }
}
