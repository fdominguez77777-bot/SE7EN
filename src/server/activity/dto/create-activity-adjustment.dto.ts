import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { ActivityType } from '../activity-event.entity';

export class CreateActivityAdjustmentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateProfileId: number;

  @ApiProperty({ enum: Object.values(ActivityType) })
  @IsIn(Object.values(ActivityType))
  type: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  delta: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
