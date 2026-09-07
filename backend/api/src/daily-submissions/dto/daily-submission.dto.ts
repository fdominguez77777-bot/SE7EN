import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveDailySubmissionRowDto {
  @Type(() => Number)
  @IsInt()
  bidderId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  gmailConfirmedApplicationCount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  verifiedInterviewCount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class SaveDailySubmissionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveDailySubmissionRowDto)
  rows: SaveDailySubmissionRowDto[];
}
