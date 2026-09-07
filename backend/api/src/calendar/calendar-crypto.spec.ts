import { decryptSecret, encryptSecret } from './calendar-crypto';

describe('calendar-crypto', () => {
  it('round-trips a secret', () => {
    const packed = encryptSecret('refresh-token', 'jwt-secret-value');
    expect(decryptSecret(packed, 'jwt-secret-value')).toBe('refresh-token');
  });
});
