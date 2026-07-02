/** Server-side idempotency guard: deduplicates identical mutating requests that
 * arrive while the first one is still running (e.g. rapid double-clicks).
 * The second caller simply receives the result of the in-flight operation
 * instead of firing the RPC twice. */
const _inflight = new Map<string, Promise<unknown>>();

export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = _inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      _inflight.delete(key);
    }
  })();
  _inflight.set(key, p);
  return p;
}

/** True if an operation with this key is currently running. */
export function isInflight(key: string): boolean {
  return _inflight.has(key);
}
