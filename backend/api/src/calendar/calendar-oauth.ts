import { createHash, randomBytes } from 'node:crypto';

export function hashConnectToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function newConnectToken() {
  return randomBytes(32).toString('hex');
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

export type CalendarIdentity = {
  email: string;
  displayName: string | null;
};

export type CalendarGuest = {
  name: string;
  email: string;
  status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
};

export type UpstreamEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  joinUrl: string | null;
  htmlLink: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  guests: CalendarGuest[];
};

async function readJson(response: Response) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: raw.slice(0, 200) };
  }
}

export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await readJson(response);
  if (!response.ok || typeof json.access_token !== 'string') {
    throw new Error(
      typeof json.error_description === 'string'
        ? json.error_description
        : 'Google token exchange failed.',
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresAt: expiresFromSeconds(json.expires_in),
  };
}

export async function refreshGoogleToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await readJson(response);
  if (!response.ok || typeof json.access_token !== 'string') {
    throw new Error('Google refresh failed.');
  }
  return {
    accessToken: json.access_token,
    refreshToken:
      typeof json.refresh_token === 'string' ? json.refresh_token : params.refreshToken,
    expiresAt: expiresFromSeconds(json.expires_in),
  };
}

export async function googleIdentity(accessToken: string): Promise<CalendarIdentity> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await readJson(response);
  if (!response.ok || typeof json.email !== 'string') {
    throw new Error('Could not read the Google account.');
  }
  return {
    email: json.email,
    displayName: typeof json.name === 'string' ? json.name : null,
  };
}

export async function googleEvents(params: {
  accessToken: string;
  from: Date;
  to: Date;
  calendarId?: string | null;
}): Promise<UpstreamEvent[]> {
  const calendars = [
    params.calendarId?.trim() || '',
    'primary',
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  let lastError = 'Google Calendar request failed.';
  for (const calendarId of calendars) {
    try {
      return await listGoogleCalendar(params.accessToken, calendarId, params.from, params.to);
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

async function listGoogleCalendar(
  accessToken: string,
  calendarId: string,
  from: Date,
  to: Date,
): Promise<UpstreamEvent[]> {
  const collected: UpstreamEvent[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      maxAttendees: '120',
    });
    if (pageToken) {
      query.set('pageToken', pageToken);
    }
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      },
    );
    const json = await readJson(response);
    if (!response.ok) {
      throw new Error(googleErrorMessage(json, response.status));
    }
    const items = Array.isArray(json.items) ? json.items : [];
    collected.push(
      ...items.flatMap((item) => mapGoogleEvent(item as Record<string, unknown>)),
    );
    pageToken = typeof json.nextPageToken === 'string' ? json.nextPageToken : '';
    if (!pageToken) {
      break;
    }
  }
  return collected;
}

function googleErrorMessage(json: Record<string, unknown>, status: number) {
  const nested = json.error;
  if (nested && typeof nested === 'object') {
    const body = nested as Record<string, unknown>;
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  }
  if (typeof json.error_description === 'string' && json.error_description.trim()) {
    return json.error_description;
  }
  if (status === 401) {
    return 'Google rejected the calendar token. Disconnect and connect the Gmail again.';
  }
  if (status === 403) {
    return 'Google Calendar API is not enabled for this Cloud project, or the account denied calendar access.';
  }
  return `Google Calendar request failed (${status}).`;
}

export function googleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'select_account consent',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ].join(' '),
    state: params.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
    scope: microsoftScope(),
  });
  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20_000),
    },
  );
  const json = await readJson(response);
  if (!response.ok || typeof json.access_token !== 'string') {
    throw new Error(
      typeof json.error_description === 'string'
        ? json.error_description
        : 'Microsoft token exchange failed.',
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresAt: expiresFromSeconds(json.expires_in),
  };
}

export async function refreshMicrosoftToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
    scope: microsoftScope(),
  });
  const response = await fetch(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(20_000),
    },
  );
  const json = await readJson(response);
  if (!response.ok || typeof json.access_token !== 'string') {
    throw new Error('Microsoft refresh failed.');
  }
  return {
    accessToken: json.access_token,
    refreshToken:
      typeof json.refresh_token === 'string' ? json.refresh_token : params.refreshToken,
    expiresAt: expiresFromSeconds(json.expires_in),
  };
}

export async function microsoftIdentity(accessToken: string): Promise<CalendarIdentity> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await readJson(response);
  const email =
    (typeof json.mail === 'string' && json.mail) ||
    (typeof json.userPrincipalName === 'string' && json.userPrincipalName) ||
    '';
  if (!response.ok || !email) {
    throw new Error('Could not read the Microsoft account.');
  }
  return {
    email,
    displayName: typeof json.displayName === 'string' ? json.displayName : null,
  };
}

export async function microsoftEvents(params: {
  accessToken: string;
  from: Date;
  to: Date;
}): Promise<UpstreamEvent[]> {
  const query = new URLSearchParams({
    startDateTime: params.from.toISOString(),
    endDateTime: params.to.toISOString(),
    $top: '250',
  });
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarView?${query}`,
    {
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  const json = await readJson(response);
  const items = Array.isArray(json.value) ? json.value : [];
  return items.flatMap((item) => mapMicrosoftEvent(item as Record<string, unknown>));
}

export function microsoftAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    response_mode: 'query',
    prompt: 'select_account',
    scope: microsoftScope(),
    state: params.state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${query}`;
}

function microsoftScope() {
  return 'offline_access User.Read Calendars.Read';
}

function expiresFromSeconds(value: unknown) {
  const seconds = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return new Date(Date.now() + seconds * 1000);
}

function mapGoogleEvent(item: Record<string, unknown>): UpstreamEvent[] {
  if (item.status === 'cancelled') {
    return [];
  }
  const start = item.start as Record<string, unknown> | undefined;
  const end = item.end as Record<string, unknown> | undefined;
  const dateTime = typeof start?.dateTime === 'string' ? start.dateTime : null;
  const date = typeof start?.date === 'string' ? start.date : null;
  if (!dateTime && !date) {
    return [];
  }
  const organizer = item.organizer as Record<string, unknown> | undefined;
  const conference = item.conferenceData as Record<string, unknown> | undefined;
  return [
    {
      id: String(item.id ?? ''),
      title: typeof item.summary === 'string' && item.summary.trim() ? item.summary : '(No title)',
      start: dateTime ?? `${date}T00:00:00`,
      end:
        (typeof end?.dateTime === 'string' && end.dateTime) ||
        (typeof end?.date === 'string' ? `${end.date}T00:00:00` : null),
      allDay: Boolean(date && !dateTime),
      location: stringOrNull(item.location),
      description: stringOrNull(item.description),
      joinUrl:
        stringOrNull(item.hangoutLink) ||
        googleConferenceUrl(conference),
      htmlLink: stringOrNull(item.htmlLink),
      organizerName: stringOrNull(organizer?.displayName),
      organizerEmail: stringOrNull(organizer?.email)?.toLowerCase() ?? null,
      guests: googleGuests(item),
    },
  ];
}

function mapMicrosoftEvent(item: Record<string, unknown>): UpstreamEvent[] {
  if (item.isCancelled === true) {
    return [];
  }
  const start = item.start as Record<string, unknown> | undefined;
  const end = item.end as Record<string, unknown> | undefined;
  const startValue = typeof start?.dateTime === 'string' ? start.dateTime : null;
  if (!startValue) {
    return [];
  }
  const location = item.location as Record<string, unknown> | undefined;
  const organizer = item.organizer as Record<string, unknown> | undefined;
  const organizerMail = asEmail(organizer?.emailAddress);
  const meeting = item.onlineMeeting as Record<string, unknown> | undefined;
  return [
    {
      id: String(item.id ?? ''),
      title: typeof item.subject === 'string' && item.subject.trim() ? item.subject : '(No title)',
      start: startValue.endsWith('Z') ? startValue : `${startValue}Z`,
      end: typeof end?.dateTime === 'string' ? (end.dateTime.endsWith('Z') ? end.dateTime : `${end.dateTime}Z`) : null,
      allDay: item.isAllDay === true,
      location: stringOrNull(location?.displayName),
      description: stringOrNull(item.bodyPreview),
      joinUrl: stringOrNull(meeting?.joinUrl) || stringOrNull(item.onlineMeetingUrl),
      htmlLink: stringOrNull(item.webLink),
      organizerName: asEmailName(organizer?.emailAddress),
      organizerEmail: organizerMail,
      guests: microsoftGuests(item, organizerMail),
    },
  ];
}

function googleConferenceUrl(conference: Record<string, unknown> | undefined) {
  const points = Array.isArray(conference?.entryPoints) ? conference.entryPoints : [];
  const video = points.find((point) => {
    const row = point as Record<string, unknown>;
    return row.entryPointType === 'video' && typeof row.uri === 'string';
  }) as Record<string, unknown> | undefined;
  const first = points.find((point) => typeof (point as Record<string, unknown>).uri === 'string') as
    | Record<string, unknown>
    | undefined;
  return stringOrNull(video?.uri) || stringOrNull(first?.uri);
}

function googleGuests(item: Record<string, unknown>): CalendarGuest[] {
  const attendees = Array.isArray(item.attendees) ? item.attendees : [];
  return attendees.flatMap((row) => {
    const guest = row as Record<string, unknown>;
    const email = stringOrNull(guest.email)?.toLowerCase();
    if (!email) {
      return [];
    }
    return [
      {
        name: stringOrNull(guest.displayName) || email,
        email,
        status: guestStatus(guest.responseStatus),
      },
    ];
  });
}

function microsoftGuests(item: Record<string, unknown>, organizerEmail: string | null): CalendarGuest[] {
  const attendees = Array.isArray(item.attendees) ? item.attendees : [];
  const guests = attendees.flatMap((row) => {
    const guest = row as Record<string, unknown>;
    const email = asEmail(guest.emailAddress);
    if (!email) {
      return [];
    }
    const status = guest.status as Record<string, unknown> | undefined;
    return [
      {
        name: asEmailName(guest.emailAddress) || email,
        email,
        status: guestStatus(status?.response),
      },
    ];
  });
  if (organizerEmail && !guests.some((guest) => guest.email === organizerEmail)) {
    guests.unshift({
      name: organizerEmail,
      email: organizerEmail,
      status: 'accepted',
    });
  }
  return guests;
}

function guestStatus(value: unknown): CalendarGuest['status'] {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  if (status === 'accepted' || status === 'organizer') {
    return 'accepted';
  }
  if (status === 'declined') {
    return 'declined';
  }
  if (status === 'tentative' || status === 'tentativelyaccepted') {
    return 'tentative';
  }
  return 'needsAction';
}

function asEmail(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return stringOrNull((value as Record<string, unknown>).address)?.toLowerCase() ?? null;
}

function asEmailName(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return stringOrNull((value as Record<string, unknown>).name);
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
