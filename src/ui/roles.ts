import type { Role } from '../api/types'

export const DEFAULT_MEMBER_PASSWORD = '12345678'

export const ROLE_OPTIONS: Role[] = ['ADMIN', 'BID_MANAGER', 'BIDDER', 'CALLER']

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  BID_MANAGER: 'Bid Manager',
  BIDDER: 'Bidder',
  CALLER: 'Caller',
}

const ROLE_PRIORITY: Role[] = ['ADMIN', 'BID_MANAGER', 'BIDDER', 'CALLER']

export function coerceRoleList(
  roles: readonly Role[] | string | null | undefined,
): Role[] {
  if (Array.isArray(roles)) {
    return roles.filter((role): role is Role => ROLE_PRIORITY.includes(role))
  }
  if (typeof roles === 'string' && roles.trim()) {
    return roles
      .replace(/[{}"]/g, '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is Role => ROLE_PRIORITY.includes(value as Role))
  }
  return []
}

export function normalizeMemberRoles(
  roles: readonly Role[] | string | null | undefined,
  fallback: Role = 'BIDDER',
): Role[] {
  const seen = new Set(coerceRoleList(roles))
  if (seen.size === 0) {
    seen.add(fallback)
  }
  return ROLE_PRIORITY.filter((role) => seen.has(role))
}

export function memberRoles(user: {
  role: Role
  roles?: Role[] | string | null
}): Role[] {
  const held = coerceRoleList(user.roles)
  if (held.length > 0) {
    return normalizeMemberRoles(held, user.role)
  }
  return [user.role]
}

export function hasMemberRole(user: { role: Role; roles?: Role[] | null }, role: Role): boolean {
  return memberRoles(user).includes(role)
}

export function hasAnyMemberRole(
  user: { role: Role; roles?: Role[] | null },
  roles: readonly Role[],
): boolean {
  const held = memberRoles(user)
  return roles.some((role) => held.includes(role))
}

/** Ensure API/localStorage users always expose a roles array. */
export function normalizeSessionUser<T extends { role: Role; roles?: Role[] | null }>(
  user: T,
): T & { roles: Role[] } {
  const roles = memberRoles(user)
  return { ...user, role: roles[0], roles }
}

export function roleBadgeTone(role: Role): 'info' | 'warning' | 'neutral' | 'success' {
  if (role === 'ADMIN') {
    return 'info'
  }
  if (role === 'BID_MANAGER') {
    return 'warning'
  }
  if (role === 'CALLER') {
    return 'success'
  }
  return 'neutral'
}

export function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim()
  const space = trimmed.indexOf(' ')
  if (space === -1) {
    return { firstName: trimmed, lastName: '' }
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  }
}

export function composeName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export function formatMemberDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
