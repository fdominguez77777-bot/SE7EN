import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttachBidderProfileDto } from './dto/attach-bidder-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: User) {
    return this.usersService.toPublicUser(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users (ADMIN)' })
  async list() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user with a specific role (ADMIN)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createFromAdmin(dto);
  }

  @Patch(':id/bidder-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attach a BIDDER user to a bidder profile' })
  attachProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AttachBidderProfileDto,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.attachBidderProfile(id, dto.bidderProfileId, actor);
  }
}
