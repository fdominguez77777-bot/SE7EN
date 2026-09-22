import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/user-role.enum';
import { LoginHistoryService } from './login-history.service';

@ApiTags('login-history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('login-history')
export class LoginHistoryController {
  constructor(private readonly loginHistory: LoginHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'List recent sign-ins (ADMIN)' })
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
