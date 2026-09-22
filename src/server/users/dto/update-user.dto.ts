import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { USERNAME_HINT, USERNAME_PATTERN } from '../username.rules';
import { UserRole } from '../user-role.enum';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'joe',
    description: 'Sign-in username (not email)',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: USERNAME_HINT })
  @MaxLength(40, { message: USERNAME_HINT })
  @Matches(USERNAME_PATTERN, { message: USERNAME_HINT })
  email?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
