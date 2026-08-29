import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateInterviewDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateProfileId: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  company: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  jobTitle: string;

  @ApiProperty()
  @IsString()
  startsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
