import {
  isAllowedCorsOrigin,
  isPrivateLanOrigin,
  parseCorsOrigin,
} from './cors';

describe('parseCorsOrigin', () => {
  it('allows any origin for *', () => {
    expect(parseCorsOrigin('*')).toBe(true);
  });

  it('returns a single origin string', () => {
    expect(parseCorsOrigin('http://localhost:5173')).toBe(
      'http://localhost:5173',
    );
  });

  it('splits comma-separated origins', () => {
    expect(
      parseCorsOrigin('http://localhost:5173, https://app.example.com'),
    ).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });
});

describe('LAN CORS', () => {
  it('recognizes RFC1918 frontend origins', () => {
    expect(isPrivateLanOrigin('http://172.20.1.44:5173')).toBe(true);
    expect(isPrivateLanOrigin('http://192.168.1.10:5173')).toBe(true);
    expect(isPrivateLanOrigin('http://10.0.0.8:5173')).toBe(true);
    expect(isPrivateLanOrigin('https://evil.example.com')).toBe(false);
  });

  it('allows configured origins and LAN in development', () => {
    expect(
      isAllowedCorsOrigin(
        'http://localhost:5173',
        'http://localhost:5173',
        true,
      ),
    ).toBe(true);
    expect(
      isAllowedCorsOrigin('http://172.20.1.44:5173', 'http://localhost:5173', true),
    ).toBe(true);
    expect(
      isAllowedCorsOrigin(
        'http://172.20.1.44:5173',
        'http://localhost:5173',
        false,
      ),
    ).toBe(false);
  });
});
