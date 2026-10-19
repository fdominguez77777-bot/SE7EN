import { UserRole } from '../users/user-role.enum';
import { hasAnyRole } from '../users/user-roles';

export const CANDIDATE_ASSIGNMENT_ROLES = [
  UserRole.ADMIN,
  UserRole.BID_MANAGER,
  UserRole.BIDDER,
] as const;

export function assignmentRejectedReason(user: {
  role: string;
  roles?: string[] | null;
  isActive?: boolean;
}): string | null {
  if (user.isActive === false) {
    return 'Disabled members cannot be assigned profiles';
  }
  if (!hasAnyRole(user, CANDIDATE_ASSIGNMENT_ROLES)) {
    return 'Only Admins, Bid Managers, and Bidders can be assigned profiles';
  }
  return null;
}
