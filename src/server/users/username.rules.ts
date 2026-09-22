import { Matches, MaxLength, MinLength } from 'class-validator';

/** Sign-in usernames only — no email domains. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{2,40}$/;

export const USERNAME_HINT =
  'Use 2–40 characters: letters, numbers, dots, underscores, or hyphens (no email).';

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isUsernameFormat(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim());
}

/** class-validator stack for username fields stored in `email`. */
export const UsernameField = () =>
  [
    MinLength(2, { message: USERNAME_HINT }),
    MaxLength(40, { message: USERNAME_HINT }),
    Matches(USERNAME_PATTERN, { message: USERNAME_HINT }),
  ] as const;
