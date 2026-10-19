import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
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

  @ApiPropertyOptional({
    enum: UserRole,
    isArray: true,
    description: 'Replace all roles for this member.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Legacy single role. Sets roles to [role] when roles is omitted.',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
