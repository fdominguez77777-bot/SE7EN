import { parseCorsOrigin } from './cors';

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
