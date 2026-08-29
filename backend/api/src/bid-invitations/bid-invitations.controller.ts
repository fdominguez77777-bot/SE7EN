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
import { BidInvitationsService } from './bid-invitations.service';
import { CreateBidInvitationDto } from './dto/create-bid-invitation.dto';
import { UpdateBidInvitationDto } from './dto/update-bid-invitation.dto';

@ApiTags('bid-invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bid-invitations')
export class BidInvitationsController {
  constructor(private readonly bidInvitationsService: BidInvitationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Invite a bidder profile to a project' })
  create(@Body() dto: CreateBidInvitationDto, @CurrentUser() user: User) {
    return this.bidInvitationsService.create(dto, user);
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @ApiOperation({ summary: 'List bid invitations' })
  findAll(
    @CurrentUser() user: User,
    @Query('projectId') projectId?: string,
  ) {
    const parsed = projectId ? Number(projectId) : undefined;
    return this.bidInvitationsService.findAll(
      user,
      parsed && Number.isInteger(parsed) ? parsed : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bid invitation' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidInvitationsService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invitation status' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBidInvitationDto,
    @CurrentUser() user: User,
  ) {
    return this.bidInvitationsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Delete a bid invitation' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidInvitationsService.remove(id, user);
  }
}
