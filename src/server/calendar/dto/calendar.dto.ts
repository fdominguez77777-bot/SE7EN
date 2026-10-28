import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

import { SCHEDULE_KINDS, type ScheduleKindName } from '../../../lib/schedule-kind';

export class AssignCalendarBidderDto {
  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedBidderId?: number | null;
}

export class SetCalendarEventKindDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1024)
  eventId: string;

  @ApiProperty({ enum: SCHEDULE_KINDS })
  @IsIn(SCHEDULE_KINDS)
  kind: ScheduleKindName;
}

export class CreateCalendarLinkDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  assignedBidderId?: number;
}
