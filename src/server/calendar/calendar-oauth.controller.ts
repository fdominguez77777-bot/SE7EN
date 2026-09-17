import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CalendarProvider, type CalendarProviderName } from './calendar.rules';
import { CalendarService } from './calendar.service';

function queryText(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] ?? '');
  }
  return typeof value === 'string' ? value : String(value ?? '');
}

function failedRedirect(connectedUrl: string, detail: string) {
  const params = new URLSearchParams({
    error: '1',
    detail: detail.slice(0, 240),
  });
  return `${connectedUrl.split('?')[0]}?${params}`;
}

@ApiTags('calendar-oauth')
@Controller('calendar/oauth')
export class CalendarOauthController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('start')
  @ApiOperation({ summary: 'Start calendar OAuth from a connect link' })
  async start(@Query('token') token: string, @Res() response: Response) {
    try {
      const url = await this.calendar.startOAuth(queryText(token));
      return response.redirect(url);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Could not start calendar connect.';
      console.error('Calendar OAuth start failed', error);
      return response.redirect(failedRedirect(this.calendar.connectedPageUrl(), detail));
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
    const origin = this.calendar.connectedPageUrl();
    if (error || !queryText(code)) {
      return response.redirect(
        failedRedirect(origin, queryText(error) || 'Google did not return an auth code.'),
      );
    }
    try {
      const next = await this.calendar.completeOAuth({
        provider,
        code: queryText(code),
        state: queryText(state),
      });
      return response.redirect(next);
    } catch (caught) {
      const detail =
        caught instanceof Error ? caught.message : 'Calendar connect failed.';
      console.error('Calendar OAuth callback failed', caught);
      return response.redirect(failedRedirect(origin, detail));
    }
  }
}
