import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { InterviewMethod, InterviewStatus } from '../interview.rules';

export class UpdateInterviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  round?: string | null;

  @ApiPropertyOptional({ enum: Object.values(InterviewMethod) })
  @IsOptional()
  @IsIn(Object.values(InterviewMethod))
  method?: string | null;

  @ApiPropertyOptional({ enum: Object.values(InterviewStatus) })
  @IsOptional()
  @IsIn(Object.values(InterviewStatus))
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  result?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}
