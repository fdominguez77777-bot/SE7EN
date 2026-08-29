import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { BidderProfilesService } from './bidder-profiles.service';
import { CreateBidderProfileDto } from './dto/create-bidder-profile.dto';
import { UpdateBidderProfileDto } from './dto/update-bidder-profile.dto';

@ApiTags('bidder-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bidder-profiles')
export class BidderProfilesController {
  constructor(private readonly bidderProfilesService: BidderProfilesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a bidder profile' })
  create(@Body() dto: CreateBidderProfileDto, @CurrentUser() user: User) {
    return this.bidderProfilesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List bidder profiles' })
  findAll(@CurrentUser() user: User) {
    return this.bidderProfilesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bidder profile' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidderProfilesService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bidder profile' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBidderProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.bidderProfilesService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a bidder profile' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.bidderProfilesService.remove(id, user);
  }
}
