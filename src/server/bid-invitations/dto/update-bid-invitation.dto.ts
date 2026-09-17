import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { InvitationStatus } from '../invitation-status.enum';

export class UpdateBidInvitationDto {
  @ApiProperty({ enum: InvitationStatus })
  @IsEnum(InvitationStatus)
  status: InvitationStatus;
}
