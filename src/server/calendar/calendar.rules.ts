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

export const CONNECT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
