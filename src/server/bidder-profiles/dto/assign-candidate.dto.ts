import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min, ValidateIf } from 'class-validator';

export class AssignCandidateDto {
  @ApiProperty({ nullable: true, type: Number })
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bidderId: number | null;
}
