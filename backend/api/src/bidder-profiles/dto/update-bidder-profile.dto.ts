import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { BidderProfileStatus } from '../bidder-profile-status.enum';

export class UpdateBidderProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ enum: BidderProfileStatus })
  @IsOptional()
  @IsEnum(BidderProfileStatus)
  status?: BidderProfileStatus;
}
