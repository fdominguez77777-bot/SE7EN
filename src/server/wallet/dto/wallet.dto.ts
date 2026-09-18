import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const WALLET_TYPES = [
  'RECEIVED',
  'PAYMENT',
  'BILLING',
  'PAYROLL',
  'ADJUSTMENT',
] as const;

const WALLET_METHODS = [
  'BANK',
  'WIRE',
  'CASH',
  'CARD',
  'CHECK',
  'OTHER',
] as const;

export class CreateWalletTransactionDto {
  @ApiProperty({ enum: WALLET_TYPES })
  @IsIn(WALLET_TYPES)
  type: (typeof WALLET_TYPES)[number];

  @ApiProperty({ example: '250.00' })
  @IsString()
  amount: string;

  @ApiProperty({ example: '2026-09-18' })
  @IsString()
  occurredOn: string;

  @ApiProperty({ example: 'Acme Staffing' })
  @IsString()
  @MaxLength(160)
  counterparty: string;

  @ApiProperty({ enum: WALLET_METHODS })
  @IsIn(WALLET_METHODS)
  method: (typeof WALLET_METHODS)[number];

  @ApiPropertyOptional({ enum: ['IN', 'OUT'] })
  @IsOptional()
  @IsIn(['IN', 'OUT'])
  direction?: 'IN' | 'OUT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateWalletTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occurredOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  counterparty?: string;

  @ApiPropertyOptional({ enum: WALLET_METHODS })
  @IsOptional()
  @IsIn(WALLET_METHODS)
  method?: (typeof WALLET_METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidWalletTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
