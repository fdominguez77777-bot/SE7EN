import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateBidInvitationDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bidderProfileId: number;
}
