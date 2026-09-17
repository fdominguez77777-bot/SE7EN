import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { BidderProfilesService } from './bidder-profiles.service';
import { AssignCandidateDto } from './dto/assign-candidate.dto';
import { CreateBidderProfileDto } from './dto/create-bidder-profile.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateBidderProfileDto } from './dto/update-bidder-profile.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';

@ApiTags('bidder-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bidder-profiles')
export class BidderProfilesController {
  constructor(private readonly bidderProfilesService: BidderProfilesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a candidate profile (ADMIN)' })
  create(@Body() dto: CreateBidderProfileDto, @CurrentUser() user: User) {
    return this.bidderProfilesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List candidate profiles' })
  findAll(@CurrentUser() user: User) {
    return this.bidderProfilesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a candidate profile' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidderProfilesService.findOne(id, user);
  }

  @Patch(':id/assignment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign or unassign a member (ADMIN)' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignCandidateDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.assignBidder(id, dto.bidderId, user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a candidate profile (ADMIN)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBidderProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a candidate profile (ADMIN)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidderProfilesService.remove(id, user);
  }

  @Post(':id/experiences')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add work experience' })
  addExperience(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWorkExperienceDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.addExperience(id, dto, user);
  }

  @Patch(':id/experiences/:experienceId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update work experience' })
  updateExperience(
    @Param('id', ParseIntPipe) id: number,
    @Param('experienceId', ParseIntPipe) experienceId: number,
    @Body() dto: UpdateWorkExperienceDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.updateExperience(
      id,
      experienceId,
      dto,
      user,
    );
  }

  @Delete(':id/experiences/:experienceId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete work experience' })
  removeExperience(
    @Param('id', ParseIntPipe) id: number,
    @Param('experienceId', ParseIntPipe) experienceId: number,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.removeExperience(id, experienceId, user);
  }

  @Post(':id/educations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Add education' })
  addEducation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEducationDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.addEducation(id, dto, user);
  }

  @Patch(':id/educations/:educationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update education' })
  updateEducation(
    @Param('id', ParseIntPipe) id: number,
    @Param('educationId', ParseIntPipe) educationId: number,
    @Body() dto: UpdateEducationDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.updateEducation(id, educationId, dto, user);
  }

  @Delete(':id/educations/:educationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete education' })
  removeEducation(
    @Param('id', ParseIntPipe) id: number,
    @Param('educationId', ParseIntPipe) educationId: number,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.removeEducation(id, educationId, user);
  }
}
