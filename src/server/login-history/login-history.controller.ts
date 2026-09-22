import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { loginRequestMeta } from './login-request-meta';
import { LoginHistoryService } from './login-history.service';

@ApiTags('login-history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('login-history')
export class LoginHistoryController {
  constructor(private readonly loginHistory: LoginHistoryService) {}

  @Post('session')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER, UserRole.BIDDER)
  @ApiOperation({
    summary: 'Record or refresh an open platform visit (any signed-in member)',
  })
  async touchSession(
    @CurrentUser() user: User,
    @Req() req: Request,
  ): Promise<void> {
    const meta = loginRequestMeta(req.headers, req.socket?.remoteAddress);
    await this.loginHistory.touchSession(user, meta);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List recent platform visits (ADMIN)' })
  list(
    @Query('userId') userIdRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const userId = userIdRaw ? Number(userIdRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.loginHistory.list({
      userId: Number.isFinite(userId) ? userId : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }
}
