import {
  clientIpAddress,
  formatLocation,
  parseUserAgent,
} from './login-request-meta';

describe('login request meta', () => {
  it('prefers the first x-forwarded-for hop', () => {
    expect(
      clientIpAddress({
        'x-forwarded-for': '203.0.113.10, 10.0.0.1',
      }),
    ).toBe('203.0.113.10');
  });

  it('parses common desktop and mobile user agents', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toEqual({ device: 'Desktop', browser: 'Chrome', os: 'Windows' });
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ device: 'Mobile', browser: 'Safari', os: 'iOS' });
  });

  it('formats location parts without empty segments', () => {
    expect(
      formatLocation({ city: 'Austin', region: 'TX', country: 'US' }),
    ).toBe('Austin, TX, US');
    expect(formatLocation({})).toBe('Unknown location');
  });
});
