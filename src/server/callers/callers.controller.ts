import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { CallersService } from './callers.service';
import { SetCallerProfilesDto } from './dto/set-caller-profiles.dto';

@ApiTags('callers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('callers')
export class CallersController {
  constructor(private readonly callers: CallersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Callers with the profiles assigned to them' })
  list() {
    return this.callers.listCallers();
  }

  @Get('profiles')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Profiles that can be assigned to callers' })
  profiles() {
    return this.callers.listAssignableProfiles();
  }

  @Get('me')
  @Roles(UserRole.CALLER)
  @ApiOperation({ summary: 'Profiles assigned to the signed-in caller' })
  mine(@CurrentUser() actor: User) {
    return this.callers.mine(actor);
  }

  @Put(':id/profiles')
  @Roles(UserRole.ADMIN, UserRole.BID_MANAGER)
  @ApiOperation({ summary: 'Replace the profiles assigned to a caller' })
  setProfiles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetCallerProfilesDto,
    @CurrentUser() actor: User,
  ) {
    return this.callers.setProfiles(id, dto.profileIds, actor);
  }
}
