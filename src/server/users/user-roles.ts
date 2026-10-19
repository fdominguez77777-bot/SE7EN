import { UserRole } from './user-role.enum';

/** Higher first — used for nav home and legacy single-role fields. */
export const ROLE_PRIORITY: UserRole[] = [
  UserRole.ADMIN,
  UserRole.BID_MANAGER,
  UserRole.BIDDER,
  UserRole.CALLER,
];

const ROLE_SET = new Set<string>(Object.values(UserRole));

export function isUserRole(value: string): value is UserRole {
  return ROLE_SET.has(value);
}

/** Dedupe, drop unknowns, sort by priority. Always returns at least one role. */
export function normalizeRoles(
  roles: readonly string[] | null | undefined,
  fallback: string = UserRole.BIDDER,
): UserRole[] {
  const seen = new Set<UserRole>();
  for (const value of roles ?? []) {
    if (isUserRole(value)) {
      seen.add(value);
    }
  }
  if (seen.size === 0 && isUserRole(fallback)) {
    seen.add(fallback);
  }
  if (seen.size === 0) {
    seen.add(UserRole.BIDDER);
  }
  return ROLE_PRIORITY.filter((role) => seen.has(role));
}

export function primaryRole(
  roles: readonly string[] | null | undefined,
  fallback: string = UserRole.BIDDER,
): UserRole {
  return normalizeRoles(roles, fallback)[0];
}

export function userRoles(user: {
  roles?: string[] | null;
  role?: string | null;
}): UserRole[] {
  if (user.roles?.length) {
    return normalizeRoles(user.roles, user.role ?? UserRole.BIDDER);
  }
  return normalizeRoles(user.role ? [user.role] : [], UserRole.BIDDER);
}

export function hasRole(
  user: { roles?: string[] | null; role?: string | null },
  role: UserRole | string,
): boolean {
  return userRoles(user).includes(role as UserRole);
}

export function hasAnyRole(
  user: { roles?: string[] | null; role?: string | null },
  roles: readonly (UserRole | string)[],
): boolean {
  const held = userRoles(user);
  return roles.some((role) => held.includes(role as UserRole));
}

export function rolesEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const a = normalizeRoles(left);
  const b = normalizeRoles(right);
  return a.length === b.length && a.every((role, index) => role === b[index]);
}
