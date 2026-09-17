import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { TALYN_BULK_LIMIT } from '../application-ingest';
import { JobApplicationStatus } from '../job-application.rules';

export class TalynSyncDto {
  @ApiProperty({ example: 'talyn-app-123' })
  @ValidateIf((dto: TalynSyncDto) => !dto.externalId)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  talynApplicationId?: string;

  @ApiPropertyOptional({ deprecated: true })
  @ValidateIf((dto: TalynSyncDto) => !dto.talynApplicationId)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  externalId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateProfileId: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  jobTitle: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  jobDescriptionText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  resumeText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  jobUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ enum: Object.values(JobApplicationStatus) })
  @IsOptional()
  @IsIn(Object.values(JobApplicationStatus))
  status?: string;

  @ApiProperty({ example: '2026-08-30T15:00:00.000Z' })
  @IsString()
  appliedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class TalynBulkSyncDto {
  @ApiProperty({ type: [TalynSyncDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(TALYN_BULK_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => TalynSyncDto)
  applications: TalynSyncDto[];
}
