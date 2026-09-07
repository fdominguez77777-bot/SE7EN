export const CalendarProvider = {
  GOOGLE: 'GOOGLE',
  MICROSOFT: 'MICROSOFT',
} as const;

export type CalendarProviderName =
  (typeof CalendarProvider)[keyof typeof CalendarProvider];

export const CALENDAR_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
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

export function publicOrigin(appPublicUrl: string | undefined, corsOrigin: string) {
  const explicit = appPublicUrl?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const first = corsOrigin.split(',')[0]?.trim() ?? '';
  return first.replace(/\/$/, '');
}
