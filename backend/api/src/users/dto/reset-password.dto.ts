import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({
    description: 'When true, sets the known default password instead of newPassword.',
  })
  @IsOptional()
  @IsBoolean()
  useDefault?: boolean;

  @ApiProperty({ minLength: 8, maxLength: 72, required: false })
  @ValidateIf((dto: ResetPasswordDto) => !dto.useDefault)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword?: string;
}
