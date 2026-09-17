import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumberString, IsOptional, IsString, Min } from 'class-validator';

export class CreateBidderRateDto {
  @ApiProperty({ example: '0.03' })
  @IsNumberString()
  applicationRate: string;

  @ApiProperty({ example: '1.00' })
  @IsNumberString()
  interviewRate: string;

  @ApiProperty()
  @IsString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateManagerSalaryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  managerId: number;

  @ApiProperty({ example: '70.00' })
  @IsNumberString()
  weeklySalary: string;

  @ApiProperty()
  @IsString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class EndIndividualBidderRateDto {
  @ApiProperty({ description: 'Date from which default rates apply again' })
  @IsString()
  effectiveTo: string;
}
