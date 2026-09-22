import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { USERNAME_HINT, USERNAME_PATTERN } from '../../users/username.rules';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'joe', description: 'Account username (not email)' })
  @IsString()
  @MinLength(2, { message: USERNAME_HINT })
  @MaxLength(40, { message: USERNAME_HINT })
  @Matches(USERNAME_PATTERN, { message: USERNAME_HINT })
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
