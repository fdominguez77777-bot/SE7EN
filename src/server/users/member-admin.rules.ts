import { UserRole } from './user-role.enum';
import {
  hasRole,
  normalizeRoles,
  primaryRole,
  rolesEqual,
  userRoles,
} from './user-roles';
import { avatarPublicUrl } from '../storage/image-kind';
import { assignmentRejectedReason } from '../bidder-profiles/assignment.rules';

export const MEMBER_ADMIN_ROLES = [UserRole.ADMIN] as const;

/** Only seed the bootstrap admin on a true empty install. Never revive a deleted account. */
export function shouldSeedDefaultAdmin(input: {
  activeAdminCount: number;
  defaultAdminExists: boolean;
}): boolean {
  return input.activeAdminCount === 0 && !input.defaultAdminExists;
}

/** ADMIN-only known password used when a member forgets their sign-in. Hashed on save. */
export const DEFAULT_MEMBER_PASSWORD = '12345678';

export const MEMBER_MESSAGES = {
  lastAdminRole:
    'The platform must have at least one Admin. This is the last Admin account, so Admin cannot be removed.',
  lastAdminDisable:
    'The platform must have at least one Admin. This is the last Admin account, so it cannot be disabled.',
  lastAdminDelete:
    'The platform must have at least one Admin. This is the last Admin account, so it cannot be deleted.',
  selfRole:
    'You cannot change your own roles. Ask another Admin if administrative access must move.',
  selfDisable: 'You cannot disable your own account.',
  selfDelete: 'You cannot delete your own account.',
  bidderAssigned:
    'This member still has assigned candidates. Reassign or unassign those candidates before removing assignment-capable roles.',
  managerHistoryDelete:
    'This Bid Manager has historical compensation records and cannot be deleted. Disable the account instead.',
  accountDisabled: 'This account has been disabled.',
  rolesRequired: 'Select at least one role.',
} as const;

export function roleChangeBlockReason(input: {
  actorId: number;
  targetId: number;
  currentRole: string;
  nextRole: string;
  activeAdminCount: number;
  assignedCandidateCount: number;
}): string | null {
  return rolesChangeBlockReason({
    actorId: input.actorId,
    targetId: input.targetId,
    currentRoles: [input.currentRole],
    nextRoles: [input.nextRole],
    activeAdminCount: input.activeAdminCount,
    assignedCandidateCount: input.assignedCandidateCount,
  });
}

export function rolesChangeBlockReason(input: {
  actorId: number;
  targetId: number;
  currentRoles: readonly string[];
  nextRoles: readonly string[];
  activeAdminCount: number;
  assignedCandidateCount: number;
}): string | null {
  const current = normalizeRoles(input.currentRoles);
  const next = normalizeRoles(input.nextRoles);
  if (rolesEqual(current, next)) {
    return null;
  }
  if (input.actorId === input.targetId) {
    return MEMBER_MESSAGES.selfRole;
  }
  if (
    current.includes(UserRole.ADMIN) &&
    !next.includes(UserRole.ADMIN) &&
    input.activeAdminCount <= 1
  ) {
    return MEMBER_MESSAGES.lastAdminRole;
  }
  if (
    input.assignedCandidateCount > 0 &&
    assignmentRejectedReason({
      role: primaryRole(next),
      roles: next,
    })
  ) {
    return MEMBER_MESSAGES.bidderAssigned;
  }
  return null;
}

export function statusChangeBlockReason(input: {
  actorId: number;
  targetId: number;
  targetRole: string;
  targetRoles?: readonly string[];
  nextIsActive: boolean;
  currentlyActive: boolean;
  activeAdminCount: number;
}): string | null {
  if (input.nextIsActive === input.currentlyActive) {
    return null;
  }
  if (!input.nextIsActive && input.actorId === input.targetId) {
    return MEMBER_MESSAGES.selfDisable;
  }
  const isAdmin = input.targetRoles
    ? hasRole(
        { role: input.targetRole, roles: [...input.targetRoles] },
        UserRole.ADMIN,
      )
    : input.targetRole === UserRole.ADMIN;
  if (!input.nextIsActive && isAdmin && input.activeAdminCount <= 1) {
    return MEMBER_MESSAGES.lastAdminDisable;
  }
  return null;
}

export function deleteBlock(input: {
  actorId: number;
  targetId: number;
  targetRole: string;
  targetRoles?: readonly string[];
  activeAdminCount: number;
  hasManagerHistory: boolean;
}): { message: string; conflict: boolean } | null {
  if (input.actorId === input.targetId) {
    return { message: MEMBER_MESSAGES.selfDelete, conflict: false };
  }
  const held = input.targetRoles
    ? normalizeRoles(input.targetRoles, input.targetRole)
    : normalizeRoles([input.targetRole]);
  if (held.includes(UserRole.ADMIN) && input.activeAdminCount <= 1) {
    return { message: MEMBER_MESSAGES.lastAdminDelete, conflict: false };
  }
  if (held.includes(UserRole.BID_MANAGER) && input.hasManagerHistory) {
    return { message: MEMBER_MESSAGES.managerHistoryDelete, conflict: true };
  }
  return null;
}

export function publicUserFields(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  roles?: string[] | null;
  isActive?: boolean;
  avatarPath?: string | null;
  created_at: Date;
  password?: string;
  passwordVault?: string | null;
}) {
  const roles = userRoles(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: primaryRole(roles),
    roles,
    isActive: user.isActive !== false,
    avatarUrl: avatarPublicUrl(user.avatarPath),
    created_at: user.created_at,
  };
}
