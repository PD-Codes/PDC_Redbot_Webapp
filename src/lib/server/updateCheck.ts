import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import pkg from '../../../package.json';

const exec = promisify(execFile);

// Hard timeout per git call. Without it, a stalled network fetch (e.g. GitHub
// unreachable/rate-limited from inside the container) would hang the child
// process indefinitely instead of failing fast.
const GIT_TIMEOUT_MS = 15_000;

// Delay before the very first automatic check runs after a server boot. This
// keeps `git fetch` off the critical startup path — it used to fire the
// moment the process came up (see ensureStarted()), competing with the app
// for the network/CPU right when it also needs to start listening and pass
// the Docker healthcheck. A short grace period lets the app come up cleanly
// first; the periodic re-checks (every intervalH hours) are unaffected.
const STARTUP_CHECK_DELAY_MS = 30_000;

// Persisted config (webapp-side, next to .update.log). 0 = automatic check off.
const CONFIG_FILE = path.join(process.cwd(), '.update-check.json');
export const ALLOWED_INTERVALS = [0, 1, 2, 4, 8, 16, 24];

export type CheckResult = {
  available: boolean;
  current: string;
  latest?: string;
  error?: string;
  checkedAt: number; // epoch ms
};

let lastResult: CheckResult | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let started = false;

// git without "dubious ownership" abort and without reading the global
// ignore/attributes files – same hardening as deploy/update.sh.
function gitArgs(cwd: string, rest: string[]): string[] {
  return [
    '-c', `safe.directory=${cwd}`,
    '-c', 'safe.directory=*',
    '-c', 'core.excludesFile=/dev/null',
    '-c', 'core.attributesFile=/dev/null',
    ...rest
  ];
}

// Compare the running version (package.json) with the version on the new PDC
// repo branch. Read-only: fetches by URL into FETCH_HEAD, never touches origin.
export async function runVersionCheck(): Promise<CheckResult> {
  const current = pkg.version;
  const cwd = process.cwd();
  const repoUrl = env.REPO_URL || 'https://github.com/PD-Codes/PDC_Redbot_Webapp';
  try {
    const branch =
      env.DEPLOY_BRANCH ||
      (await exec('git', gitArgs(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']), { cwd, timeout: GIT_TIMEOUT_MS })).stdout.trim() ||
      'main';
    await exec('git', gitArgs(cwd, ['fetch', '--quiet', repoUrl, branch]), { cwd, timeout: GIT_TIMEOUT_MS });
    const { stdout } = await exec('git', gitArgs(cwd, ['show', 'FETCH_HEAD:package.json']), { cwd, timeout: GIT_TIMEOUT_MS });
    const latest: string = JSON.parse(stdout).version ?? '';
    lastResult = latest
      ? { available: current !== latest, current, latest, checkedAt: Date.now() }
      : { available: false, current, error: 'Remote-Version nicht gefunden', checkedAt: Date.now() };
  } catch (e) {
    lastResult = {
      available: false,
      current,
      error: e instanceof Error ? e.message : 'Pruefung fehlgeschlagen',
      checkedAt: Date.now()
    };
  }
  return lastResult;
}

export function getLastResult(): CheckResult | null {
  return lastResult;
}

export function getIntervalH(): number {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const n = Number(c.intervalH);
    return ALLOWED_INTERVALS.includes(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setIntervalH(h: number): number {
  const n = ALLOWED_INTERVALS.includes(Number(h)) ? Number(h) : 0;
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ intervalH: n }));
  } catch {
    /* best effort */
  }
  scheduleFromConfig();
  // Run once right away when enabling, so the UI reflects it quickly.
  if (n > 0) runVersionCheck().catch(() => {});
  return n;
}

function scheduleFromConfig(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  const h = getIntervalH();
  if (h > 0) {
    timer = setInterval(() => {
      runVersionCheck().catch(() => {});
    }, h * 3_600_000);
  }
}

// Called once at server start (from hooks.server.ts). Idempotent.
// Schedules the recurring timer immediately (cheap, just a setInterval), but
// defers the "check right now" git fetch by STARTUP_CHECK_DELAY_MS so it
// doesn't run in the same breath as process boot — see the comment on
// STARTUP_CHECK_DELAY_MS above.
export function ensureStarted(): void {
  if (started) return;
  started = true;
  try {
    scheduleFromConfig();
    if (getIntervalH() > 0) {
      setTimeout(() => {
        runVersionCheck().catch(() => {});
      }, STARTUP_CHECK_DELAY_MS).unref();
    }
  } catch {
    /* never block startup */
  }
}
