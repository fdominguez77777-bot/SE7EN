import {
  calendarColor,
  calendarInitials,
  canAssignCalendar,
  canConnectCalendar,
  canSeeCalendarPerson,
  isConnectLinkOpen,
  publicOrigin,
} from './calendar.rules';

describe('calendar.rules', () => {
  it('picks a stable color by id', () => {
    expect(calendarColor(1)).toBe(calendarColor(9));
    expect(calendarColor(1)).not.toBe(calendarColor(2));
  });

  it('builds initials from a name or email', () => {
    expect(calendarInitials('Chris K Garcia', '')).toBe('CKG');
    expect(calendarInitials('', 'fdominguez77777@gmail.com')).toBe('FDO');
  });

  it('lets only admins create calendar connect links', () => {
    expect(canConnectCalendar('ADMIN')).toBe(true);
    expect(canConnectCalendar('BID_MANAGER')).toBe(false);
    expect(canConnectCalendar('BIDDER')).toBe(false);
  });

  it('lets admins, bid managers, and bidders own calendars', () => {
    expect(canAssignCalendar('ADMIN')).toBe(true);
    expect(canAssignCalendar('BID_MANAGER')).toBe(true);
    expect(canAssignCalendar('BIDDER')).toBe(true);
    expect(canAssignCalendar('GUEST')).toBe(false);
  });

  it('lets bidders see other bidders only', () => {
    expect(canSeeCalendarPerson('BIDDER', 'BIDDER')).toBe(true);
    expect(canSeeCalendarPerson('BIDDER', 'BID_MANAGER')).toBe(false);
    expect(canSeeCalendarPerson('BIDDER', 'ADMIN')).toBe(false);
    expect(canSeeCalendarPerson('BID_MANAGER', 'ADMIN')).toBe(true);
    expect(canSeeCalendarPerson('ADMIN', 'ADMIN')).toBe(true);
  });

  it('keeps connect links reusable until they expire', () => {
    const now = new Date('2026-09-03T12:00:00Z');
    expect(
      isConnectLinkOpen({
        expiresAt: new Date('2026-09-10T12:00:00Z'),
        usedAt: null,
        now,
      }),
    ).toBe(true);
    expect(
      isConnectLinkOpen({
        expiresAt: new Date('2026-09-10T12:00:00Z'),
        usedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      isConnectLinkOpen({
        expiresAt: new Date('2026-09-01T12:00:00Z'),
        usedAt: null,
        now,
      }),
    ).toBe(false);
  });

  it('prefers APP_PUBLIC_URL over CORS origin', () => {
    expect(publicOrigin('http://localhost/', 'http://localhost:5173')).toBe(
      'http://localhost',
    );
    expect(publicOrigin('', 'http://localhost:5173,http://127.0.0.1')).toBe(
      'http://localhost:5173',
    );
  });
});
