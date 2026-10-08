import {
  calendarColor,
  calendarInitials,
  resolveCalendarProfileName,
  canAssignCalendar,
  canConnectCalendar,
  canSeeCalendarPerson,
  isConnectLinkOpen,
  isThisMailboxCalendar,
  originFromRequest,
  publicOrigin,
  shouldSyncGoogleCalendar,
} from './calendar.rules';

describe('calendar.rules', () => {
  it('picks a stable color by id', () => {
    expect(calendarColor(1)).toBe(calendarColor(9));
    expect(calendarColor(1)).not.toBe(calendarColor(2));
  });

  it('labels a calendar with the matching profile name', () => {
    const profiles = [
      { name: 'Fabian Dominguez', email: 'fdominguez0420@gamil.com', assignedBidderId: 2 },
      { name: 'David Barberis', email: 'davidbarberis1001@gmail.com', assignedBidderId: 7 },
      { name: 'Cameron Hicks', email: 'cameronhicks10001@gmail.com', assignedBidderId: 4 },
    ];
    expect(
      resolveCalendarProfileName(
        { email: 'cameronhicks10001@gmail.com', displayName: 'Joe', assignedBidderId: 4 },
        profiles,
      ),
    ).toBe('Cameron Hicks');
    expect(
      resolveCalendarProfileName(
        {
          email: 'dbarberis071994@gmail.com',
          displayName: 'David Barberis',
          assignedBidderId: 7,
        },
        profiles,
      ),
    ).toBe('David Barberis');
    expect(
      resolveCalendarProfileName(
        { email: 'solo@gmail.com', displayName: 'Gmail', assignedBidderId: 4 },
        profiles,
      ),
    ).toBe('Cameron Hicks');
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
    expect(canSeeCalendarPerson('CALLER', 'ADMIN')).toBe(true);
    expect(canSeeCalendarPerson('CALLER', 'BIDDER')).toBe(true);
    expect(canAssignCalendar('CALLER')).toBe(false);
    expect(canConnectCalendar('CALLER')).toBe(false);
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

  it('keeps this inbox calendar and drops other Gmails shared into it', () => {
    const email = 'fdominguez77777@gmail.com';
    expect(isThisMailboxCalendar(email, email, true)).toBe(true);
    expect(isThisMailboxCalendar('primary', email, false)).toBe(true);
    expect(isThisMailboxCalendar('cameronhicks10001@gmail.com', email, false)).toBe(false);
    expect(isThisMailboxCalendar('fdominguez0420@gmail.com', email, false)).toBe(false);
    expect(
      isThisMailboxCalendar('en.usa#holiday@group.v.calendar.google.com', email, false),
    ).toBe(false);
  });

  it('skips Google holiday and contacts calendars', () => {
    expect(shouldSyncGoogleCalendar('person@gmail.com')).toBe(true);
    expect(shouldSyncGoogleCalendar('primary')).toBe(true);
    expect(
      shouldSyncGoogleCalendar('en.usa#holiday@group.v.calendar.google.com'),
    ).toBe(false);
    expect(
      shouldSyncGoogleCalendar(
        'addressbook#contacts@group.v.calendar.google.com',
      ),
    ).toBe(false);
  });

  it('builds the connect origin from the request host', () => {
    expect(
      originFromRequest({
        host: 'localhost:3000',
        protocol: 'http',
      }),
    ).toBe('http://localhost:3000');
    expect(
      originFromRequest({
        forwardedHost: 'se7en.example.com',
        forwardedProto: 'https',
      }),
    ).toBe('https://se7en.example.com');
    expect(originFromRequest({ host: 'bad host' })).toBe('');
  });

  it('uses APP_PUBLIC_URL, then the Vercel host', () => {
    expect(publicOrigin('http://localhost/', 'example.vercel.app')).toBe(
      'http://localhost',
    );
    expect(publicOrigin('', 'example.vercel.app')).toBe(
      'https://example.vercel.app',
    );
  });
});
