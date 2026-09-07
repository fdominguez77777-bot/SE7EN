import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EnvironmentVariables } from '../config/env.validation';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { CalendarAccount } from './calendar-account.entity';
import { CalendarConnectLink } from './calendar-connect-link.entity';
import { decryptSecret, encryptSecret } from './calendar-crypto';
import {
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  googleAuthUrl,
  googleEvents,
  googleIdentity,
  hashConnectToken,
  microsoftAuthUrl,
  microsoftEvents,
  microsoftIdentity,
  newConnectToken,
  refreshGoogleToken,
  refreshMicrosoftToken,
  type TokenSet,
  type UpstreamEvent,
} from './calendar-oauth';
import {
  CalendarProvider,
  CONNECT_LINK_TTL_MS,
  calendarColor,
  calendarInitials,
  canAssignCalendar,
  canSeeCalendarPerson,
  isConnectLinkOpen,
  publicOrigin,
  type CalendarProviderName,
} from './calendar.rules';

export type CalendarAccountDto = {
  id: number;
  provider: string;
  email: string;
  displayName: string;
  initials: string;
  color: string;
  assignedBidderId: number | null;
  assignedBidderName: string | null;
};

export type CalendarBidderDto = {
  id: number;
  name: string;
  email: string;
  role: string;
  calendarEmail: string | null;
  calendarEmails: string[];
  accountId: number | null;
  accountIds: number[];
  color: string;
  initials: string;
};

export type CalendarEventDto = {
  id: string;
  accountId: number;
  bidderId: number | null;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  color: string;
  email: string;
  initials: string;
  location: string | null;
  description: string | null;
  joinUrl: string | null;
  htmlLink: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  guests: Array<{
    name: string;
    email: string;
    status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
};

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarAccount)
    private readonly accounts: Repository<CalendarAccount>,
    @InjectRepository(CalendarConnectLink)
    private readonly links: Repository<CalendarConnectLink>,
    private readonly users: UsersService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async listAccounts(): Promise<CalendarAccountDto[]> {
    const [rows, people] = await Promise.all([
      this.accounts.find({ order: { id: 'ASC' } }),
      this.users.findCalendarPeople(),
    ]);
    const names = new Map(people.map((row) => [row.id, row.name]));
    return rows.map((row) =>
      this.toAccountDto(
        row,
        row.assignedBidderId ? names.get(row.assignedBidderId) ?? null : null,
      ),
    );
  }

  async listBidders(actor: User): Promise<CalendarBidderDto[]> {
    await this.autoAssignByEmail();
    const people = (await this.users.findCalendarPeople()).filter((person) =>
      canSeeCalendarPerson(actor.role, person.role),
    );
    const accounts = await this.accounts.find({ order: { id: 'ASC' } });
    return people.map((person) => this.toPersonDto(person, accounts));
  }

  async createConnectLink(
    provider: CalendarProviderName,
    actorId: number,
    assignedBidderId?: number,
  ) {
    this.requireProviderConfig(provider);
    if (assignedBidderId) {
      await this.requireAssignablePerson(assignedBidderId);
    }
    const token = newConnectToken();
    const expiresAt = new Date(Date.now() + CONNECT_LINK_TTL_MS);
    await this.links.save(
      this.links.create({
        tokenHash: hashConnectToken(token),
        provider,
        createdById: actorId,
        assignedBidderId: assignedBidderId ?? null,
        expiresAt,
        usedAt: null,
      }),
    );
    const origin = this.origin();
    return {
      url: `${origin}/calendar/connect/${token}`,
      expiresAt: expiresAt.toISOString(),
      provider,
    };
  }

  async startOAuth(token: string) {
    const link = await this.requireOpenLink(token);
    const provider = link.provider as CalendarProviderName;
    this.requireProviderConfig(provider);
    const state = `${provider}:${token}`;
    if (provider === CalendarProvider.GOOGLE) {
      return googleAuthUrl({
        clientId: this.google().clientId,
        redirectUri: this.redirectUri('google'),
        state,
      });
    }
    return microsoftAuthUrl({
      clientId: this.microsoft().clientId,
      redirectUri: this.redirectUri('microsoft'),
      state,
    });
  }

  async completeOAuth(params: {
    provider: CalendarProviderName;
    code: string;
    state: string;
  }) {
    const [providerPart, token] = params.state.split(':');
    if (providerPart !== params.provider || !token) {
      throw new BadRequestException('Invalid calendar connect state.');
    }
    const link = await this.requireOpenLink(token);
    if (link.provider !== params.provider) {
      throw new BadRequestException('Invalid calendar connect state.');
    }
    const tokens =
      params.provider === CalendarProvider.GOOGLE
        ? await exchangeGoogleCode({
            code: params.code,
            clientId: this.google().clientId,
            clientSecret: this.google().clientSecret,
            redirectUri: this.redirectUri('google'),
          })
        : await exchangeMicrosoftCode({
            code: params.code,
            clientId: this.microsoft().clientId,
            clientSecret: this.microsoft().clientSecret,
            redirectUri: this.redirectUri('microsoft'),
          });
    const identity =
      params.provider === CalendarProvider.GOOGLE
        ? await googleIdentity(tokens.accessToken)
        : await microsoftIdentity(tokens.accessToken);
    const existing = await this.accounts.findOne({
      where: { provider: params.provider, email: identity.email.toLowerCase() },
    });
    const saved = existing ?? this.accounts.create();
    saved.provider = params.provider;
    saved.email = identity.email.toLowerCase();
    saved.displayName = identity.displayName;
    saved.calendarId = 'primary';
    this.applyTokens(saved, tokens, existing?.refreshToken ?? null);
    const ownerId =
      link.assignedBidderId ||
      (await this.personIdForEmail(identity.email)) ||
      saved.assignedBidderId;
    if (ownerId) {
      saved.assignedBidderId = ownerId;
    }
    await this.accounts.save(saved);
    link.usedAt = new Date();
    await this.links.save(link);
    return `${this.origin()}/calendar/connected?token=${encodeURIComponent(token)}`;
  }

  async assignBidder(accountId: number, assignedBidderId: number | null | undefined) {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('Calendar not found.');
    }
    if (assignedBidderId) {
      await this.requireAssignablePerson(assignedBidderId);
      account.assignedBidderId = assignedBidderId;
    } else {
      account.assignedBidderId = null;
    }
    await this.accounts.save(account);
    return this.listAccounts();
  }

  async removeAccount(id: number) {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException('Calendar not found.');
    }
    await this.accounts.remove(account);
  }

  async resetAll() {
    await this.accounts.clear();
  }

  async listEvents(
    fromIso: string,
    toIso: string,
    actor?: User,
  ): Promise<CalendarEventDto[]> {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Provide a valid from and to range.');
    }
    await this.autoAssignByEmail();
    const people = await this.users.findCalendarPeople();
    const hiddenOwnerIds = new Set(
      people
        .filter((person) => !canSeeCalendarPerson(actor?.role, person.role))
        .map((person) => person.id),
    );
    const accounts = (await this.accounts.find({ order: { id: 'ASC' } })).filter(
      (account) =>
        !account.assignedBidderId || !hiddenOwnerIds.has(account.assignedBidderId),
    );
    const failures: string[] = [];
    const batches = await Promise.all(
      accounts.map(async (account) => {
        try {
          const access = await this.freshAccessToken(account);
          const events =
            account.provider === CalendarProvider.GOOGLE
              ? await googleEvents({
                  accessToken: access,
                  from,
                  to,
                  calendarId: account.email,
                })
              : await microsoftEvents({ accessToken: access, from, to });
          return events.map((event) => this.toEventDto(account, event));
        } catch (error) {
          const detail = error instanceof Error ? error.message : 'Calendar sync failed.';
          failures.push(`${account.email}: ${detail}`);
          return [] as CalendarEventDto[];
        }
      }),
    );
    const events = batches.flat().sort((left, right) => left.start.localeCompare(right.start));
    if (events.length === 0 && failures.length > 0) {
      throw new BadGatewayException(failures.join(' '));
    }
    return events;
  }

  connectedPageUrl() {
    return `${this.origin()}/calendar/connected`;
  }

  private async requireOpenLink(token: string, provider?: CalendarProviderName) {
    const link = await this.links.findOne({
      where: { tokenHash: hashConnectToken(token) },
    });
    if (
      !link ||
      !isConnectLinkOpen(link) ||
      (provider && link.provider !== provider)
    ) {
      throw new BadRequestException('This calendar link is invalid or expired.');
    }
    return link;
  }

  private async freshAccessToken(account: CalendarAccount) {
    const secret = this.secret();
    const access = decryptSecret(account.accessToken, secret);
    const stillValid =
      account.accessExpiresAt &&
      account.accessExpiresAt.getTime() - Date.now() > 60_000;
    if (stillValid) {
      return access;
    }
    if (!account.refreshToken) {
      return access;
    }
    const refresh = decryptSecret(account.refreshToken, secret);
    const tokens =
      account.provider === CalendarProvider.GOOGLE
        ? await refreshGoogleToken({
            refreshToken: refresh,
            clientId: this.google().clientId,
            clientSecret: this.google().clientSecret,
          })
        : await refreshMicrosoftToken({
            refreshToken: refresh,
            clientId: this.microsoft().clientId,
            clientSecret: this.microsoft().clientSecret,
          });
    this.applyTokens(account, tokens, account.refreshToken);
    await this.accounts.save(account);
    return tokens.accessToken;
  }

  private applyTokens(
    account: CalendarAccount,
    tokens: TokenSet,
    previousEncryptedRefresh: string | null,
  ) {
    const secret = this.secret();
    account.accessToken = encryptSecret(tokens.accessToken, secret);
    if (tokens.refreshToken) {
      account.refreshToken = encryptSecret(tokens.refreshToken, secret);
    } else {
      account.refreshToken = previousEncryptedRefresh;
    }
    account.accessExpiresAt = tokens.expiresAt;
  }

  private toAccountDto(row: CalendarAccount, bidderName: string | null = null): CalendarAccountDto {
    const displayName = row.displayName?.trim() || row.email;
    return {
      id: row.id,
      provider: row.provider,
      email: row.email,
      displayName,
      initials: calendarInitials(displayName, row.email),
      color: calendarColor(row.id),
      assignedBidderId: row.assignedBidderId,
      assignedBidderName: bidderName,
    };
  }

  private toEventDto(account: CalendarAccount, event: UpstreamEvent): CalendarEventDto {
    const dto = this.toAccountDto(account);
    return {
      id: `${account.id}:${event.id}`,
      accountId: account.id,
      bidderId: account.assignedBidderId,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      color: account.assignedBidderId
        ? calendarColor(account.assignedBidderId)
        : dto.color,
      email: dto.email,
      initials: dto.initials,
      location: event.location,
      description: event.description,
      joinUrl: event.joinUrl,
      htmlLink: event.htmlLink,
      organizerName: event.organizerName,
      organizerEmail: event.organizerEmail,
      guests: event.guests,
    };
  }

  private toPersonDto(person: User, accounts: CalendarAccount[]): CalendarBidderDto {
    const linked = accounts.filter((row) => row.assignedBidderId === person.id);
    const emails = linked.map((row) => row.email);
    return {
      id: person.id,
      name: person.name,
      email: person.email,
      role: person.role,
      calendarEmail: emails[0] ?? null,
      calendarEmails: emails,
      accountId: linked[0]?.id ?? null,
      accountIds: linked.map((row) => row.id),
      color: calendarColor(person.id),
      initials: calendarInitials(person.name, emails[0] || person.email),
    };
  }

  private async autoAssignByEmail() {
    const [accounts, people] = await Promise.all([
      this.accounts.find(),
      this.users.findCalendarPeople(),
    ]);
    const byEmail = new Map(people.map((row) => [row.email.toLowerCase(), row.id]));
    for (const account of accounts) {
      if (account.assignedBidderId) {
        continue;
      }
      const ownerId = byEmail.get(account.email);
      if (!ownerId) {
        continue;
      }
      account.assignedBidderId = ownerId;
      await this.accounts.save(account);
    }
  }

  private async personIdForEmail(email: string) {
    const people = await this.users.findCalendarPeople();
    return people.find((row) => row.email.toLowerCase() === email.toLowerCase())?.id ?? null;
  }

  private async requireAssignablePerson(id: number) {
    const user = await this.users.findById(id);
    if (!user || !user.isActive || !canAssignCalendar(user.role)) {
      throw new BadRequestException('Assign the calendar to you, a bid manager, or a bidder.');
    }
    return user;
  }

  private origin() {
    return publicOrigin(
      this.config.get('APP_PUBLIC_URL', { infer: true }),
      this.config.get('CORS_ORIGIN', { infer: true }),
    );
  }

  private redirectUri(provider: 'google' | 'microsoft') {
    return `${this.origin()}/api/calendar/oauth/${provider}/callback`;
  }

  private secret() {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  private google() {
    const clientId = this.config.get('GOOGLE_CLIENT_ID', { infer: true })?.trim() ?? '';
    const clientSecret =
      this.config.get('GOOGLE_CLIENT_SECRET', { infer: true })?.trim() ?? '';
    return { clientId, clientSecret };
  }

  private microsoft() {
    const clientId = this.config.get('MICROSOFT_CLIENT_ID', { infer: true })?.trim() ?? '';
    const clientSecret =
      this.config.get('MICROSOFT_CLIENT_SECRET', { infer: true })?.trim() ?? '';
    return { clientId, clientSecret };
  }

  private requireProviderConfig(provider: CalendarProviderName) {
    if (provider === CalendarProvider.GOOGLE) {
      const { clientId, clientSecret } = this.google();
      if (!clientId || !clientSecret) {
        throw new ServiceUnavailableException(
          'Google Calendar is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
        );
      }
      return;
    }
    const { clientId, clientSecret } = this.microsoft();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Microsoft Calendar is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.',
      );
    }
  }
}
