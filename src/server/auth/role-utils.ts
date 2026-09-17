import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';

export function isStaff(user: User): boolean {
  return (
    user.role === UserRole.ADMIN || user.role === UserRole.BID_MANAGER
  );
}

export function isBidder(user: User): boolean {
  return user.role === UserRole.BIDDER;
}
