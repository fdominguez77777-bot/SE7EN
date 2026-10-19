import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { hasAnyRole, hasRole } from '../users/user-roles';

export function isStaff(user: User): boolean {
  return hasAnyRole(user, [UserRole.ADMIN, UserRole.BID_MANAGER]);
}

export function isBidder(user: User): boolean {
  return hasRole(user, UserRole.BIDDER);
}
