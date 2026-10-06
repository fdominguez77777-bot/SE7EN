export const CalendarProvider = {
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
} as const;

export type CalendarProviderName =
  (typeof CalendarProvider)[keyof typeof CalendarProvider];

export const CALENDAR_COLORS = [
  '#5b8def',
  '#3fb68b',
  '#e0a84e',
  '#e0678f',
  '#9b7be6',
  '#3eb3c9',
  '#e5824f',
  '#9cc25a',
];

/** Reusable connect links. Google Testing-mode refresh tokens still expire in 7 days. */
export const CONNECT_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function calendarColor(id: number) {
  return CALENDAR_COLORS[Math.abs(id) % CALENDAR_COLORS.length];
}

export function canConnectCalendar(role: string | null | undefined) {
  return role === 'ADMIN';
}

export function canAssignCalendar(role: string | null | undefined) {
  return role === 'ADMIN' || role === 'BID_MANAGER' || role === 'BIDDER';
}

export function canSeeCalendarPerson(
  actorRole: string | null | undefined,
  personRole: string | null | undefined,
) {
  if (actorRole === 'BIDDER' && personRole !== 'BIDDER') {
    return false;
  }
  return true;
}

export type CalendarProfileRef = {
  name: string;
  email: string | null;
  assignedBidderId: number | null;
};

/** Persona on a connected calendar: profile email, then profile name, then the only profile that bidder owns. */
export function resolveCalendarProfileName(
  account: {
    email: string;
    displayName: string | null;
    assignedBidderId: number | null;
  },
  profiles: CalendarProfileRef[],
) {
  const email = account.email.trim().toLowerCase();
  const byEmail = email
    ? profiles.find((row) => (row.email ?? '').trim().toLowerCase() === email)
    : undefined;
  if (byEmail?.name.trim()) {
    return byEmail.name.trim();
  }

  const display = (account.displayName ?? '').trim().toLowerCase();
  if (display) {
    const byName = profiles.find((row) => row.name.trim().toLowerCase() === display);
    if (byName?.name.trim()) {
      return byName.name.trim();
    }
  }

  if (account.assignedBidderId != null) {
    const owned = profiles.filter((row) => row.assignedBidderId === account.assignedBidderId);
    if (owned.length === 1 && owned[0].name.trim()) {
      return owned[0].name.trim();
    }
  }

  const fallback = account.displayName?.trim() ?? '';
  return fallback && !fallback.includes('@') ? fallback : null;
}

export function calendarInitials(name: string, email: string) {
  const named = name.trim();
  if (named && !named.includes('@')) {
    const parts = named.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0] + (parts[2]?.[0] ?? parts[0][1] ?? ''))
        .slice(0, 3)
        .toUpperCase();
    }
    return named.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  }
  const local = (email.split('@')[0] || email).replace(/[^a-zA-Z0-9]/g, '');
  return local.slice(0, 3).toUpperCase() || 'CAL';
}

export function isConnectLinkOpen(params: {
  expiresAt: Date;
  usedAt?: Date | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  return params.expiresAt.getTime() > now.getTime();
}

/**
 * The connected inbox's own calendar.
 * Google can mark other Gmail addresses as owner when they are shared into this account.
 */
export function isThisMailboxCalendar(id: string, email: string, primary: unknown) {
  const calendarId = id.trim().toLowerCase();
  const account = email.trim().toLowerCase();
  if (!calendarId || !shouldSyncGoogleCalendar(calendarId)) {
    return false;
  }
  if (primary === true) {
    return true;
  }
  return calendarId === account || calendarId === 'primary';
}

/** Skip Google system calendars that are not interview schedules. */
export function shouldSyncGoogleCalendar(id: string) {
  const value = id.trim().toLowerCase();
  if (!value) {
    return false;
  }
  if (value.includes('#holiday@group.v.calendar.google.com')) {
    return false;
  }
  if (value.includes('#contacts@group.v.calendar.google.com')) {
    return false;
  }
  if (
    value.includes('@group.v.calendar.google.com') &&
    (value.includes('birthday') || value.includes('holiday'))
  ) {
    return false;
  }
  return true;
}

function firstHeader(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(',')[0]?.trim() ?? '';
}

/** Origin of the browser that asked for a connect link, so OAuth returns to that site. */
export function originFromRequest(input: {
  host?: string | string[];
  forwardedHost?: string | string[];
  forwardedProto?: string | string[];
  protocol?: string;
}) {
  const host = firstHeader(input.forwardedHost) || firstHeader(input.host);
  if (!host || /[\s/\\]/.test(host)) {
    return '';
  }
  const forwarded = firstHeader(input.forwardedProto);
  const protocol =
    forwarded ||
    input.protocol ||
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const proto = protocol.split(',')[0].trim().toLowerCase();
  if (proto !== 'http' && proto !== 'https') {
    return '';
  }
  return `${proto}://${host}`.replace(/\/$/, '');
}

export function publicOrigin(
  appPublicUrl: string | undefined,
  vercelHost?: string,
) {
  const explicit = appPublicUrl?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const host = vercelHost?.trim();
  if (!host) {
    return '';
  }
  if (/^https?:\/\//i.test(host)) {
    return host.replace(/\/$/, '');
  }
  return `https://${host.replace(/\/$/, '')}`;
}
