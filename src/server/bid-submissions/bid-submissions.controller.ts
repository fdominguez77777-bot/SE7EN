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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { BidSubmissionsService } from './bid-submissions.service';
import { CreateBidSubmissionDto } from './dto/create-bid-submission.dto';
import { UpdateBidSubmissionDto } from './dto/update-bid-submission.dto';

@ApiTags('bid-submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bid-submissions')
export class BidSubmissionsController {
  constructor(private readonly bidSubmissionsService: BidSubmissionsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.BIDDER)
  @ApiOperation({ summary: 'Submit a bid for an invited project' })
  create(@Body() dto: CreateBidSubmissionDto, @CurrentUser() user: User) {
    return this.bidSubmissionsService.create(dto, user);
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @ApiOperation({ summary: 'List bid submissions' })
  findAll(
    @CurrentUser() user: User,
    @Query('projectId') projectId?: string,
  ) {
    const parsed = projectId ? Number(projectId) : undefined;
    return this.bidSubmissionsService.findAll(
      user,
      parsed && Number.isInteger(parsed) ? parsed : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bid submission' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidSubmissionsService.findOne(id, user);
  }

  @Post(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Accept a submitted bid' })
  accept(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidSubmissionsService.accept(id, user);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Reject a submitted or accepted bid' })
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidSubmissionsService.reject(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bid submission' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBidSubmissionDto,
    @CurrentUser() user: User,
  ) {
    return this.bidSubmissionsService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bid submission' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidSubmissionsService.remove(id, user);
  }
}
