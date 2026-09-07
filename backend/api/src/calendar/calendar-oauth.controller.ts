import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CalendarProvider, type CalendarProviderName } from './calendar.rules';
import { CalendarService } from './calendar.service';

@ApiTags('calendar-oauth')
@Controller('calendar/oauth')
export class CalendarOauthController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('start')
  @ApiOperation({ summary: 'Start calendar OAuth from a connect link' })
  async start(@Query('token') token: string, @Res() response: Response) {
    try {
      const url = await this.calendar.startOAuth(token || '');
      return response.redirect(url);
    } catch {
      return response.redirect(`${this.calendar.connectedPageUrl()}?error=1`);
    }
  }

  @Get('google/start')
  @ApiOperation({ summary: 'Start Google Calendar OAuth from a connect link' })
  async googleStart(@Query('token') token: string, @Res() response: Response) {
    return this.start(token, response);
  }

  @Get('microsoft/start')
  @ApiOperation({ summary: 'Start Microsoft Calendar OAuth from a connect link' })
  async microsoftStart(@Query('token') token: string, @Res() response: Response) {
    return this.start(token, response);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    return this.finish(CalendarProvider.GOOGLE, code, state, error, response);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    return this.finish(CalendarProvider.MICROSOFT, code, state, error, response);
  }

  private async finish(
    provider: CalendarProviderName,
    code: string,
    state: string,
    error: string | undefined,
    response: Response,
  ) {
    if (error || !code) {
      return response.redirect(`${this.calendar.connectedPageUrl()}?error=1`);
    }
    try {
      const next = await this.calendar.completeOAuth({ provider, code, state });
      return response.redirect(next);
    } catch {
      return response.redirect(`${this.calendar.connectedPageUrl()}?error=1`);
    }
  }
}
