import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AttachBidderProfileDto } from './dto/attach-bidder-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { MEMBER_ADMIN_ROLES } from './member-admin.rules';
import { UsersService } from './users.service';
import { AVATAR_FIELD, AVATAR_MAX_BYTES } from '../storage/image-kind';

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

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor(AVATAR_FIELD, { limits: { fileSize: AVATAR_MAX_BYTES } }),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload the current user profile photo' })
  uploadMyAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file?: { buffer: Buffer; size: number },
  ) {
    return this.usersService.setAvatar(user.id, user, file);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove the current user profile photo' })
  removeMyAvatar(@CurrentUser() user: User) {
    return this.usersService.clearAvatar(user.id, user);
  }

  @Get('bidders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List BIDDER users (staff)' })
  async listBidders() {
    const users = await this.usersService.findBidders();
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Get('managers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List BID_MANAGER users (ADMIN)' })
  async listManagers() {
    const users = await this.usersService.findManagers();
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users (ADMIN)' })
  async list() {
    const users = await this.usersService.findAll();
    return users.map((user) => this.usersService.toPublicUser(user));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a member (ADMIN)' })
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getMember(id);
  }

  @Post(':id/avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @UseInterceptors(
    FileInterceptor(AVATAR_FIELD, { limits: { fileSize: AVATAR_MAX_BYTES } }),
  )
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a member profile photo (ADMIN)' })
  uploadMemberAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.setAvatar(id, actor, file);
  }

  @Delete(':id/avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a member profile photo (ADMIN)' })
  removeMemberAvatar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.clearAvatar(id, actor);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user with a specific role (ADMIN)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createFromAdmin(dto);
  }

  @Patch(':id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a new password for a member (ADMIN)' })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.resetPassword(id, dto, actor);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update member name, email, role, or status (ADMIN)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.updateMember(id, dto, actor);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a member when safe (ADMIN)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.usersService.removeMember(id, actor);
  }

  @Patch(':id/bidder-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MEMBER_ADMIN_ROLES)
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
