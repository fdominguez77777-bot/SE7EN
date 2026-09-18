import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import {
  CreateWalletTransactionDto,
  UpdateWalletTransactionDto,
  VoidWalletTransactionDto,
} from './dto/wallet.dto';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Private wallet ledger for the signed-in member' })
  ledger(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.wallet.getLedger(user, { from, to, type, search });
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Post a transaction to the signed-in member wallet' })
  create(
    @Body() dto: CreateWalletTransactionDto,
    @CurrentUser() user: User,
  ) {
    return this.wallet.create(dto, user);
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Update a transaction on the signed-in member wallet' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWalletTransactionDto,
    @CurrentUser() user: User,
  ) {
    return this.wallet.update(id, dto, user);
  }

  @Post('transactions/:id/void')
  @ApiOperation({ summary: 'Void a transaction on the signed-in member wallet' })
  voidEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VoidWalletTransactionDto,
    @CurrentUser() user: User,
  ) {
    return this.wallet.void(id, dto, user);
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Delete a transaction from the signed-in member wallet' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.wallet.remove(id, user);
  }
}
