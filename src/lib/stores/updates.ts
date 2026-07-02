import { writable } from 'svelte/store';

/** Shared "cog updates available" badge count for the sidebar.
 * Refreshed on layout mount and after cog update actions so the badge
 * does not keep showing a stale number. */
export const cogUpdateCount = writable<number>(0);

let _inflight: Promise<void> | null = null;

/** Re-fetch the badge count from the monitor endpoint (owner-only; non-owners
 * simply get no badge). Deduplicates concurrent calls. */
export function refreshCogUpdateCount(): Promise<void> {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const r = await fetch('/api/monitor');
      if (!r.ok) return;
      const j = await r.json();
      if (j && !j.error) {
        cogUpdateCount.set(Array.isArray(j.last?.cogs) ? j.last.cogs.length : 0);
      }
    } catch {
      // Badge is non-critical; keep the previous value on transient errors.
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}
