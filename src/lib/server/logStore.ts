import fs from 'node:fs';
import path from 'node:path';
import { env } from '$env/dynamic/private';

/** File-based persistence for bot log entries.
 *
 * The gateway keeps logs only in an in-memory ring buffer, so a bot restart
 * wipes them. Whenever the webapp fetches logs it merges them into an NDJSON
 * file on disk (with rotation + retention). When the gateway is offline or
 * was restarted, the logs page can still serve the persisted entries.
 */
export interface StoredLogEntry {
  time: number;
  level: string;
  levelno: number;
  logger: string;
  message: string;
  exc: string | null;
}

const DIR = env.LOG_STORE_DIR || path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'bot-logs.ndjson');
const MAX_BYTES = 2 * 1024 * 1024; // rotate the active file at ~2 MB
const MAX_ROTATIONS = 3; // bot-logs.ndjson.1 … .3
const RETENTION_DAYS = 14; // drop entries older than this on read
const MAX_ENTRIES = 5000; // hard cap for what we keep in memory / serve

// In-memory index of already persisted entries (avoids duplicate lines when the
// same ring-buffer content is fetched repeatedly). Rebuilt lazily from disk.
let _known: Set<string> | null = null;
let _writeQueue: Promise<void> = Promise.resolve();

function entryKey(e: StoredLogEntry): string {
  return `${e.time}|${e.logger}|${e.levelno}|${e.message}`;
}

function ensureDir(): void {
  try {
    fs.mkdirSync(DIR, { recursive: true });
  } catch {
    /* mkdir errors surface on write */
  }
}

function rotationFiles(): string[] {
  const files = [FILE];
  for (let i = 1; i <= MAX_ROTATIONS; i++) files.push(`${FILE}.${i}`);
  return files;
}

function readAllFromDisk(): StoredLogEntry[] {
  const out: StoredLogEntry[] = [];
  // Oldest rotation first so newer entries win on truncation.
  for (const f of rotationFiles().reverse()) {
    let text: string;
    try {
      text = fs.readFileSync(f, 'utf-8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as StoredLogEntry;
        if (typeof e.time === 'number' && typeof e.message === 'string') out.push(e);
      } catch {
        /* skip corrupt line */
      }
    }
  }
  return out;
}

function loadKnown(): Set<string> {
  if (_known) return _known;
  _known = new Set(readAllFromDisk().map(entryKey));
  return _known;
}

function rotateIfNeeded(): void {
  let size = 0;
  try {
    size = fs.statSync(FILE).size;
  } catch {
    return;
  }
  if (size < MAX_BYTES) return;
  try {
    // Shift bot-logs.ndjson.2 -> .3, .1 -> .2, active -> .1
    for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
      const from = `${FILE}.${i}`;
      const to = `${FILE}.${i + 1}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.renameSync(FILE, `${FILE}.1`);
  } catch (e) {
    console.error('[logStore] rotation failed:', e);
  }
}

/** Merge freshly fetched log entries into the persistent store (append-only,
 * deduplicated). Serialized through a queue so concurrent requests do not
 * interleave writes. Never throws – persistence is best-effort. */
export function persistLogs(entries: StoredLogEntry[]): void {
  if (!entries?.length) return;
  _writeQueue = _writeQueue.then(() => {
    try {
      ensureDir();
      const known = loadKnown();
      const fresh = entries.filter((e) => e && typeof e.time === 'number' && !known.has(entryKey(e)));
      if (!fresh.length) return;
      // Oldest first so the file stays chronologically ordered.
      fresh.sort((a, b) => a.time - b.time);
      const lines = fresh.map((e) => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(FILE, lines, 'utf-8');
      for (const e of fresh) known.add(entryKey(e));
      rotateIfNeeded();
    } catch (e) {
      console.error('[logStore] persist failed:', e);
    }
  });
}

/** Read persisted logs (newest first), applying retention and the optional
 * level/query filters used by the logs UI. */
export function readPersistedLogs(opts?: {
  level?: string;
  query?: string;
  limit?: number;
}): StoredLogEntry[] {
  let entries: StoredLogEntry[];
  try {
    entries = readAllFromDisk();
  } catch (e) {
    console.error('[logStore] read failed:', e);
    return [];
  }
  const cutoff = Date.now() / 1000 - RETENTION_DAYS * 86400;
  entries = entries.filter((e) => e.time >= cutoff);
  const level = (opts?.level ?? '').toUpperCase();
  if (level) {
    const MIN: Record<string, number> = { DEBUG: 10, INFO: 20, WARNING: 30, ERROR: 40, CRITICAL: 50 };
    const min = MIN[level] ?? 0;
    entries = entries.filter((e) => (e.levelno ?? 0) >= min);
  }
  const q = (opts?.query ?? '').trim().toLowerCase();
  if (q) entries = entries.filter((e) => `${e.message} ${e.logger}`.toLowerCase().includes(q));
  // Newest first, capped.
  entries.sort((a, b) => b.time - a.time);
  const limit = Math.min(opts?.limit ?? 500, MAX_ENTRIES);
  return entries.slice(0, limit);
}
