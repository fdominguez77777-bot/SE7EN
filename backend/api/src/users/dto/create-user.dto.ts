import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty()
  @IsEmail()
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

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}
