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
import {
  CreateTaskCommentDto,
  CreateTaskDto,
  TaskOccurrenceDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Tasks visible to the signed-in member' })
  list(
    @CurrentUser() user: User,
    @Query('scope') scope?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('assignee') assignee?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tasks.list(user, { scope, status, priority, type, assignee, search, from, to });
  }

  @Get('people')
  @ApiOperation({ summary: 'Active teammates who can be assigned tasks' })
  people() {
    return this.tasks.people();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Task with its activity and comments' })
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasks.detail(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasks.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task fields (status, assignee, priority…)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasks.update(id, dto, user);
  }

  @Post(':id/occurrences')
  @ApiOperation({ summary: 'Mark a task done (or open again) for one day' })
  setOccurrence(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TaskOccurrenceDto,
    @CurrentUser() user: User,
  ) {
    return this.tasks.setOccurrence(id, dto, user);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Comment on a task' })
  comment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.tasks.comment(id, dto, user);
  }

  @Delete(':id/comments/:commentId')
  @ApiOperation({ summary: 'Delete your comment' })
  removeComment(
    @Param('id', ParseIntPipe) id: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: User,
  ) {
    return this.tasks.removeComment(id, commentId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task (reporter or admin)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasks.remove(id, user);
  }
}
