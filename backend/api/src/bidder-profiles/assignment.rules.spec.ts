import { UserRole } from '../users/user-role.enum';
import { assignmentRejectedReason } from './assignment.rules';

describe('assignment.rules', () => {
  it('allows Admin, Bid Manager, and Bidder', () => {
    expect(assignmentRejectedReason({ role: UserRole.ADMIN })).toBeNull();
    expect(assignmentRejectedReason({ role: UserRole.BID_MANAGER })).toBeNull();
    expect(assignmentRejectedReason({ role: UserRole.BIDDER })).toBeNull();
  });

  it('rejects disabled members', () => {
    expect(
      assignmentRejectedReason({ role: UserRole.ADMIN, isActive: false }),
    ).toBe('Disabled members cannot be assigned profiles');
  });
});
