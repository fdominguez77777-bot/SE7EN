export const CALLER_MANAGER_ROLES = ['ADMIN', 'BID_MANAGER'] as const;

export function canManageCallers(role: string | null | undefined) {
  return role === 'ADMIN' || role === 'BID_MANAGER';
}

export type CallerProfileScope = {
  id: number;
  name: string;
  fullName: string;
  email: string | null;
};

export function normalizeProfileKey(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Profile name, legal name, and email keys a caller is allowed to match on. */
export function profileScopeKeys(profiles: CallerProfileScope[]) {
  const names = new Set<string>();
  const emails = new Set<string>();
  for (const profile of profiles) {
    for (const value of [profile.name, profile.fullName]) {
      const key = normalizeProfileKey(value);
      if (key) {
        names.add(key);
      }
    }
    const email = normalizeProfileKey(profile.email);
    if (email) {
      emails.add(email);
    }
  }
  return { names, emails };
}

/** JiraCoders labels applications by profile name (or first + last name). */
export function applicationInCallerScope(
  profileName: string | null | undefined,
  scope: ReturnType<typeof profileScopeKeys>,
) {
  const key = normalizeProfileKey(profileName);
  return Boolean(key) && scope.names.has(key);
}

/** A connected Gmail belongs to the caller when it is an assigned profile's inbox or persona. */
export function calendarInCallerScope(
  account: { email: string },
  resolvedProfileName: string | null,
  scope: ReturnType<typeof profileScopeKeys>,
) {
  if (scope.emails.has(normalizeProfileKey(account.email))) {
    return true;
  }
  const key = normalizeProfileKey(resolvedProfileName);
  return Boolean(key) && scope.names.has(key);
}

export function fullProfileName(profile: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}) {
  return [profile.firstName, profile.middleName, profile.lastName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
