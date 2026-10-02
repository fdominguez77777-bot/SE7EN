import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { TASK_REPEATS } from '../../../lib/task-schedule';
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../task.rules';

export class CreateTaskDto {
  @ApiProperty({ example: 'Refresh resume for the Acme profile' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional()
  @IsIn(TASK_TYPES)
  type?: (typeof TASK_TYPES)[number];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  assigneeUserIds?: number[];

  @ApiPropertyOptional({ example: '2026-10-09', nullable: true })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({ enum: TASK_REPEATS })
  @IsOptional()
  @IsIn(TASK_REPEATS)
  repeat?: (typeof TASK_REPEATS)[number];

  @ApiPropertyOptional({ description: 'Weekday bitmask, Monday = 1 … Sunday = 64', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(127)
  repeatDays?: number | null;

  @ApiPropertyOptional({ example: '2026-10-05' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-30', nullable: true })
  @IsOptional()
  @IsString()
  endDate?: string | null;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional()
  @IsIn(TASK_TYPES)
  type?: (typeof TASK_TYPES)[number];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  assigneeUserIds?: number[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @ApiPropertyOptional({ enum: TASK_REPEATS })
  @IsOptional()
  @IsIn(TASK_REPEATS)
  repeat?: (typeof TASK_REPEATS)[number];

  @ApiPropertyOptional({ description: 'Weekday bitmask, Monday = 1 … Sunday = 64', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(127)
  repeatDays?: number | null;

  @ApiPropertyOptional({ example: '2026-10-05' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-30', nullable: true })
  @IsOptional()
  @IsString()
  endDate?: string | null;
}

export class CreateTaskCommentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;
}

export class TaskOccurrenceDto {
  @ApiProperty({ example: '2026-10-05' })
  @IsString()
  date: string;

  @ApiProperty()
  @IsBoolean()
  done: boolean;
}