import {
  applicationInCallerScope,
  calendarInCallerScope,
  canManageCallers,
  fullProfileName,
  profileScopeKeys,
} from './caller.rules';

describe('caller.rules', () => {
  const scope = profileScopeKeys([
    {
      id: 1,
      name: 'Cameron Hicks',
      fullName: 'Cameron J Hicks',
      email: 'CameronHicks10001@gmail.com',
    },
  ]);
  const empty = profileScopeKeys([]);

  it('lets admins and bid managers assign profiles to callers', () => {
    expect(canManageCallers('ADMIN')).toBe(true);
    expect(canManageCallers('BID_MANAGER')).toBe(true);
    expect(canManageCallers('BIDDER')).toBe(false);
    expect(canManageCallers('CALLER')).toBe(false);
  });

  it('matches applications by profile name or legal name', () => {
    expect(applicationInCallerScope('cameron  hicks', scope)).toBe(true);
    expect(applicationInCallerScope('Cameron J Hicks', scope)).toBe(true);
    expect(applicationInCallerScope('David Barberis', scope)).toBe(false);
    expect(applicationInCallerScope(null, scope)).toBe(false);
    expect(applicationInCallerScope('Cameron Hicks', empty)).toBe(false);
  });

  it('matches a Gmail by profile email or resolved persona', () => {
    expect(
      calendarInCallerScope({ email: 'cameronhicks10001@gmail.com' }, null, scope),
    ).toBe(true);
    expect(
      calendarInCallerScope({ email: 'other@gmail.com' }, 'Cameron Hicks', scope),
    ).toBe(true);
    expect(
      calendarInCallerScope({ email: 'other@gmail.com' }, 'David Barberis', scope),
    ).toBe(false);
    expect(
      calendarInCallerScope({ email: 'cameronhicks10001@gmail.com' }, null, empty),
    ).toBe(false);
  });

  it('joins name parts', () => {
    expect(fullProfileName({ firstName: 'Ann', middleName: null, lastName: 'Lee' })).toBe(
      'Ann Lee',
    );
  });
});
