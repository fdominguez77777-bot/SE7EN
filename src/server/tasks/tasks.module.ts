import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { TaskActivity } from './task-activity.entity';
import { TaskCompletion } from './task-completion.entity';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskActivity, TaskCompletion, User]), AuthModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
