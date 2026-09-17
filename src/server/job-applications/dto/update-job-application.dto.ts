import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import {
  JobApplicationSource,
  JobApplicationStatus,
} from '../job-application.rules';

export class UpdateJobApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  jobUrl?: string | null;

  @ApiPropertyOptional({ enum: Object.values(JobApplicationSource) })
  @IsOptional()
  @IsIn(Object.values(JobApplicationSource))
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceExternalId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appliedAt?: string;

  @ApiPropertyOptional({ enum: Object.values(JobApplicationStatus) })
  @IsOptional()
  @IsIn(Object.values(JobApplicationStatus))
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  jobDescriptionText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  resumeText?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}
