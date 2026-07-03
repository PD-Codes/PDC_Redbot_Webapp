import fs from 'node:fs';
import path from 'node:path';
import { env } from '$env/dynamic/private';

/** Tracks cogs that were updated through the webapp since the bot's monitor
 * last ran. The gateway's `monitor_last.cogs` list is only refreshed by the
 * bot's periodic check (which may even be disabled), so right after an update
 * it still lists the cog as outdated – which made the sidebar badge show a
 * stale count. The monitor endpoint filters those out until the next real
 * check supersedes them.
 *
 * Persisted to disk: the webapp restarts frequently (self-update, deploys),
 * and a purely in-memory map made the stale badge come back after every
 * restart when the bot-side monitor is disabled. */
const DIR = env.LOG_STORE_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'updated-cogs.json');

const _updatedAt = new Map<string, number>(); // cog name (lowercase) -> updated at (unix seconds)
let _loaded = false;

function load(): void {
  if (_loaded) return;
  _loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8')) as Record<string, number>;
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number') _updatedAt.set(k, v);
    }
  } catch {
    /* no file yet or unreadable – start empty */
  }
}

function save(): void {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(_updatedAt)), 'utf-8');
  } catch (e) {
    console.error('[updatedCogs] persist failed:', e);
  }
}

export function recordCogUpdated(cog: string): void {
  if (!cog) return;
  load();
  _updatedAt.set(cog.toLowerCase(), Math.floor(Date.now() / 1000));
  save();
}

/** Remove cogs from `cogs` that were updated via the webapp AFTER the bot's
 * last monitor check (checkedAt, unix seconds). Entries older than the last
 * real check are pruned – the bot's own result supersedes them. */
export function filterRecentlyUpdated(cogs: string[], checkedAt: number): string[] {
  load();
  // Prune superseded entries so the file does not grow forever.
  let dirty = false;
  for (const [k, at] of _updatedAt) {
    if (at <= (checkedAt || 0)) {
      _updatedAt.delete(k);
      dirty = true;
    }
  }
  if (dirty) save();
  return (cogs ?? []).filter((c) => !_updatedAt.has(String(c).toLowerCase()));
}
