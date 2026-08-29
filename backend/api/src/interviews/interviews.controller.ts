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
import { CreateInterviewDto } from './dto/create-interview.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { InterviewsService } from './interviews.service';

@ApiTags('interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Create an interview' })
  create(@Body() dto: CreateInterviewDto, @CurrentUser() user: User) {
    return this.interviewsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List interviews' })
  findAll(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.interviewsService.findAll(
      user,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Update an interview' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInterviewDto,
    @CurrentUser() user: User,
  ) {
    return this.interviewsService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Delete an interview' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.interviewsService.remove(id, user);
  }
}
