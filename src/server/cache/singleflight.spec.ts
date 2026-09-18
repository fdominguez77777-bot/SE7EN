import { singleflight, TtlCache } from './singleflight';

describe('singleflight', () => {
  it('shares one in-flight promise for the same key', async () => {
    const flights = new Map<string, Promise<number>>();
    let runs = 0;
    const run = () =>
      singleflight(flights, 'dashboard', async () => {
        runs += 1;
        await Promise.resolve();
        return 7;
      });

    const [first, second] = await Promise.all([run(), run()]);

    expect(first).toBe(7);
    expect(second).toBe(7);
    expect(runs).toBe(1);
  });
});

describe('TtlCache', () => {
  it('returns a fresh value and expires after the ttl', () => {
    jest.useFakeTimers();
    const cache = new TtlCache<string>(1_000);
    cache.set('user:1', 'Ada');
    expect(cache.get('user:1')).toBe('Ada');
    jest.advanceTimersByTime(1_001);
    expect(cache.get('user:1')).toBeUndefined();
    jest.useRealTimers();
  });
});
