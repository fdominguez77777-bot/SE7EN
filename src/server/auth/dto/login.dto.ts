import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Username, or a legacy email still stored on older accounts. */
const LOGIN_PATTERN =
  /^[a-zA-Z0-9._-]{2,40}$|^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class LoginDto {
  @ApiProperty({
    example: 'joe',
    description: 'Account username (legacy Gmail still accepted until changed)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(LOGIN_PATTERN, {
    message: 'Enter your username (or your previous email if not updated yet).',
  })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
