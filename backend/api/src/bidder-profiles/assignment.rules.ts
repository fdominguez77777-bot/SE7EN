import { UserRole } from '../users/user-role.enum';

export const CANDIDATE_ASSIGNMENT_ROLES = [
  UserRole.ADMIN,
  UserRole.BID_MANAGER,
  UserRole.BIDDER,
] as const;

export function assignmentRejectedReason(user: {
  role: string;
  isActive?: boolean;
}): string | null {
  if (user.isActive === false) {
    return 'Disabled members cannot be assigned profiles';
  }
  if (
    user.role !== UserRole.ADMIN &&
    user.role !== UserRole.BID_MANAGER &&
    user.role !== UserRole.BIDDER
  ) {
    return 'Only Admins, Bid Managers, and Bidders can be assigned profiles';
  }
  return null;
}
