import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AttachBidderProfileDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bidderProfileId: number;
}
