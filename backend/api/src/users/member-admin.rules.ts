import { UserRole } from './user-role.enum';
import { avatarPublicUrl } from '../storage/image-kind';
import { assignmentRejectedReason } from '../bidder-profiles/assignment.rules';

export const MEMBER_ADMIN_ROLES = [UserRole.ADMIN] as const;

/** ADMIN-only known password used when a member forgets their sign-in. Hashed on save. */
export const DEFAULT_MEMBER_PASSWORD = '12345678';

export const MEMBER_MESSAGES = {
  lastAdminRole:
    'The platform must have at least one Admin. This is the last Admin account, so the role cannot be changed.',
  lastAdminDisable:
    'The platform must have at least one Admin. This is the last Admin account, so it cannot be disabled.',
  lastAdminDelete:
    'The platform must have at least one Admin. This is the last Admin account, so it cannot be deleted.',
  selfRole:
    'You cannot change your own role. Ask another Admin if administrative access must move.',
  selfDisable: 'You cannot disable your own account.',
  selfDelete: 'You cannot delete your own account.',
  bidderAssigned:
    'This bidder still has assigned candidates. Reassign or unassign those candidates before changing the role.',
  managerHistoryDelete:
    'This Bid Manager has historical compensation records and cannot be deleted. Disable the account instead.',
  accountDisabled: 'This account has been disabled.',
} as const;

export function roleChangeBlockReason(input: {
  actorId: number;
  targetId: number;
  currentRole: string;
  nextRole: string;
  activeAdminCount: number;
  assignedCandidateCount: number;
}): string | null {
  if (input.currentRole === input.nextRole) {
    return null;
  }
  if (input.actorId === input.targetId) {
    return MEMBER_MESSAGES.selfRole;
  }
  if (
    input.currentRole === UserRole.ADMIN &&
    input.nextRole !== UserRole.ADMIN &&
    input.activeAdminCount <= 1
  ) {
    return MEMBER_MESSAGES.lastAdminRole;
  }
  if (
    input.assignedCandidateCount > 0 &&
    assignmentRejectedReason({ role: input.nextRole })
  ) {
    return MEMBER_MESSAGES.bidderAssigned;
  }
  return null;
}

export function statusChangeBlockReason(input: {
  actorId: number;
  targetId: number;
  targetRole: string;
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
  if (
    !input.nextIsActive &&
    input.targetRole === UserRole.ADMIN &&
    input.activeAdminCount <= 1
  ) {
    return MEMBER_MESSAGES.lastAdminDisable;
  }
  return null;
}

export function deleteBlock(input: {
  actorId: number;
  targetId: number;
  targetRole: string;
  activeAdminCount: number;
  hasManagerHistory: boolean;
}): { message: string; conflict: boolean } | null {
  if (input.actorId === input.targetId) {
    return { message: MEMBER_MESSAGES.selfDelete, conflict: false };
  }
  if (input.targetRole === UserRole.ADMIN && input.activeAdminCount <= 1) {
    return { message: MEMBER_MESSAGES.lastAdminDelete, conflict: false };
  }
  if (input.targetRole === UserRole.BID_MANAGER && input.hasManagerHistory) {
    return { message: MEMBER_MESSAGES.managerHistoryDelete, conflict: true };
  }
  return null;
}

export function publicUserFields(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  avatarPath?: string | null;
  created_at: Date;
  password?: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive !== false,
    avatarUrl: avatarPublicUrl(user.avatarPath),
    created_at: user.created_at,
  };
}
