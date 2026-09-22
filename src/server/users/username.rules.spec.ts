import {
  isUsernameFormat,
  normalizeUsername,
  USERNAME_HINT,
  USERNAME_PATTERN,
} from './username.rules';

describe('username rules', () => {
  it('normalizes usernames without requiring an email domain', () => {
    expect(normalizeUsername('  Joe.Hicks ')).toBe('joe.hicks');
    expect(isUsernameFormat('manni')).toBe(true);
    expect(isUsernameFormat('admin')).toBe(true);
    expect(isUsernameFormat('joe_1')).toBe(true);
    expect(isUsernameFormat('a')).toBe(false);
    expect(isUsernameFormat('joe@gmail.com')).toBe(false);
    expect(USERNAME_PATTERN.test('vincent')).toBe(true);
    expect(USERNAME_HINT.toLowerCase()).toContain('no email');
  });
});
