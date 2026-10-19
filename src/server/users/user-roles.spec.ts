import { UserRole } from './user-role.enum';
import {
  hasAnyRole,
  hasRole,
  normalizeRoles,
  primaryRole,
  rolesEqual,
  userRoles,
} from './user-roles';

describe('user-roles', () => {
  it('normalizes, dedupes, and sorts by priority', () => {
    expect(
      normalizeRoles([UserRole.BIDDER, UserRole.BID_MANAGER, UserRole.BIDDER]),
    ).toEqual([UserRole.BID_MANAGER, UserRole.BIDDER]);
    expect(primaryRole([UserRole.CALLER, UserRole.ADMIN])).toBe(UserRole.ADMIN);
  });

  it('falls back when empty', () => {
    expect(normalizeRoles([])).toEqual([UserRole.BIDDER]);
    expect(userRoles({ role: UserRole.ADMIN })).toEqual([UserRole.ADMIN]);
  });

  it('checks membership', () => {
    const vincent = {
      role: UserRole.BID_MANAGER,
      roles: [UserRole.BID_MANAGER, UserRole.BIDDER],
    };
    expect(hasRole(vincent, UserRole.BIDDER)).toBe(true);
    expect(hasRole(vincent, UserRole.CALLER)).toBe(false);
    expect(hasAnyRole(vincent, [UserRole.ADMIN, UserRole.BIDDER])).toBe(true);
  });

  it('compares role lists', () => {
    expect(
      rolesEqual(
        [UserRole.BIDDER, UserRole.BID_MANAGER],
        [UserRole.BID_MANAGER, UserRole.BIDDER],
      ),
    ).toBe(true);
    expect(rolesEqual([UserRole.BIDDER], [UserRole.BID_MANAGER])).toBe(false);
  });
});
