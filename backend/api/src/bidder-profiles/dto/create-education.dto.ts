import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEducationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  institutionName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  degree?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string | null;
}
