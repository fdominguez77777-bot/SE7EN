import bcrypt from 'bcrypt';

import { UserRole } from './user-role.enum';
import {
  DEFAULT_MEMBER_PASSWORD,
  MEMBER_ADMIN_ROLES,
  MEMBER_MESSAGES,
  deleteBlock,
  publicUserFields,
  roleChangeBlockReason,
  statusChangeBlockReason,
} from './member-admin.rules';

describe('member-admin.rules', () => {
  it('uses 12345678 as the ADMIN default password for forgotten sign-in', () => {
    expect(DEFAULT_MEMBER_PASSWORD).toBe('12345678');
    expect(DEFAULT_MEMBER_PASSWORD.length).toBeGreaterThanOrEqual(8);
  });

  it('restricts member administration to ADMIN', () => {
    expect([...MEMBER_ADMIN_ROLES]).toEqual([UserRole.ADMIN]);
    expect(MEMBER_ADMIN_ROLES).not.toContain(UserRole.BID_MANAGER);
    expect(MEMBER_ADMIN_ROLES).not.toContain(UserRole.BIDDER);
  });
  it('allows role change away from BIDDER while candidates remain assigned', () => {
    expect(
      roleChangeBlockReason({
        actorId: 1,
        targetId: 10,
        currentRole: UserRole.BIDDER,
        nextRole: UserRole.ADMIN,
        activeAdminCount: 2,
        assignedCandidateCount: 2,
      }),
    ).toBeNull();
  });

  it('allows role change away from BIDDER when unassigned', () => {
    expect(
      roleChangeBlockReason({
        actorId: 1,
        targetId: 10,
        currentRole: UserRole.BIDDER,
        nextRole: UserRole.BID_MANAGER,
        activeAdminCount: 2,
        assignedCandidateCount: 0,
      }),
    ).toBeNull();
  });

  it('blocks an ADMIN from changing their own role', () => {
    expect(
      roleChangeBlockReason({
        actorId: 1,
        targetId: 1,
        currentRole: UserRole.ADMIN,
        nextRole: UserRole.BID_MANAGER,
        activeAdminCount: 3,
        assignedCandidateCount: 0,
      }),
    ).toBe(MEMBER_MESSAGES.selfRole);
  });

  it('blocks changing the last ADMIN away from ADMIN', () => {
    expect(
      roleChangeBlockReason({
        actorId: 2,
        targetId: 1,
        currentRole: UserRole.ADMIN,
        nextRole: UserRole.BID_MANAGER,
        activeAdminCount: 1,
        assignedCandidateCount: 0,
      }),
    ).toBe(MEMBER_MESSAGES.lastAdminRole);
  });

  it('blocks disabling the last ADMIN', () => {
    expect(
      statusChangeBlockReason({
        actorId: 2,
        targetId: 1,
        targetRole: UserRole.ADMIN,
        nextIsActive: false,
        currentlyActive: true,
        activeAdminCount: 1,
      }),
    ).toBe(MEMBER_MESSAGES.lastAdminDisable);
  });

  it('blocks an ADMIN from disabling themselves', () => {
    expect(
      statusChangeBlockReason({
        actorId: 1,
        targetId: 1,
        targetRole: UserRole.ADMIN,
        nextIsActive: false,
        currentlyActive: true,
        activeAdminCount: 3,
      }),
    ).toBe(MEMBER_MESSAGES.selfDisable);
  });

  it('blocks deleting the last ADMIN', () => {
    expect(
      deleteBlock({
        actorId: 2,
        targetId: 1,
        targetRole: UserRole.ADMIN,
        activeAdminCount: 1,
        hasManagerHistory: false,
      }),
    ).toEqual({ message: MEMBER_MESSAGES.lastAdminDelete, conflict: false });
  });

  it('allows deleting a BIDDER with historical records', () => {
    expect(
      deleteBlock({
        actorId: 1,
        targetId: 10,
        targetRole: UserRole.BIDDER,
        activeAdminCount: 2,
        hasManagerHistory: false,
      }),
    ).toBeNull();
  });

  it('never includes password on serialized member fields', () => {
    const publicUser = publicUserFields({
      id: 1,
      name: 'Admin',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      isActive: true,
      created_at: new Date('2026-01-01'),
      password: '$2b$10$secret-hash',
    });
    expect(publicUser).not.toHaveProperty('password');
    expect(publicUser).not.toHaveProperty('avatarPath');
    expect(publicUser.avatarUrl).toBeNull();
    expect(JSON.stringify(publicUser)).not.toContain('$2b$');
    expect(publicUser.isActive).toBe(true);
  });

  it('hashes a replacement password so the previous secret no longer matches', async () => {
    const hash = await bcrypt.hash('new-secret-99', 10);
    expect(hash).not.toBe('new-secret-99');
    expect(await bcrypt.compare('new-secret-99', hash)).toBe(true);
    expect(await bcrypt.compare('old-secret-12', hash)).toBe(false);
  });
});
