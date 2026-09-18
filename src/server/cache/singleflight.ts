export class TtlCache<T> {
  private readonly store = new Map<string, { at: number; value: T }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit || Date.now() - hit.at >= this.ttlMs) {
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T) {
    this.store.set(key, { at: Date.now(), value });
  }

  clear() {
    this.store.clear();
  }
}

export function singleflight<T>(
  flights: Map<string, Promise<T>>,
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const open = flights.get(key);
  if (open) {
    return open;
  }
  const pending = run().finally(() => {
    flights.delete(key);
  });
  flights.set(key, pending);
  return pending;
}
