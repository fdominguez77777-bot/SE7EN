import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';

import { USERNAME_HINT, USERNAME_PATTERN } from '../username.rules';
import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'joe', description: 'Sign-in username (not email)' })
  @IsString()
  @MinLength(2, { message: USERNAME_HINT })
  @MaxLength(40, { message: USERNAME_HINT })
  @Matches(USERNAME_PATTERN, { message: USERNAME_HINT })
  email: string;

  @ApiPropertyOptional({
    description: 'When true, the account is created with the default password.',
  })
  @IsOptional()
  @IsBoolean()
  useDefaultPassword?: boolean;

  @ApiProperty({ minLength: 8, maxLength: 72, required: false })
  @ValidateIf((dto: CreateUserDto) => !dto.useDefaultPassword)
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    isArray: true,
    description: 'One or more roles. Prefer this over singular role.',
  })
  @ValidateIf((dto: CreateUserDto) => !dto.role)
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiPropertyOptional({
    enum: UserRole,
    description: 'Legacy single role. Used when roles is omitted.',
  })
  @ValidateIf((dto: CreateUserDto) => !dto.roles?.length)
  @IsEnum(UserRole)
  role?: UserRole;
}
