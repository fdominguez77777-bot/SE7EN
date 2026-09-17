import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveWeeklyInvoiceRowDto {
  @Type(() => Number)
  @IsInt()
  bidderId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  invoiceApplicationCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  invoiceInterviewCount?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  invoiceApplicationRate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  invoiceInterviewRate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  countAdjustmentReason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rateAdjustmentReason?: string | null;
}

export class SaveWeeklyInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  managerNotes?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  noActivityDates?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  missingDayAcknowledgement?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveWeeklyInvoiceRowDto)
  rows: SaveWeeklyInvoiceRowDto[];
}
