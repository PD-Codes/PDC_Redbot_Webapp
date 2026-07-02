import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, isTransientRpcError } from '$lib/server/rpc';
import { persistLogs, readPersistedLogs } from '$lib/server/logStore';
import { rememberOwner, wasRecentlyOwner } from '$lib/server/ownerCache';

export interface LogEntry {
  time: number;
  level: string;
  levelno: number;
  logger: string;
  message: string;
  exc: string | null;
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  const auth = authFromUser(locals.user);

  let isOwner = false;
  let online = true;
  try {
    const ov = await rpc<{ is_owner: boolean }>('dashboard.overview', {}, auth);
    isOwner = !!ov.is_owner;
    rememberOwner(locals.user.id, isOwner);
  } catch (e) {
    online = false;
    console.error('[logs] dashboard.overview failed:', e);
    // Gateway down: fall back to the last positive owner verification so the
    // owner can still read the persisted log history while the bot is offline.
    isOwner = wasRecentlyOwner(locals.user.id);
  }

  let logs: LogEntry[] = [];
  let cached = false;
  if (isOwner && online) {
    try {
      const r = await rpc<{ logs: LogEntry[] }>('logs.list', { limit: 300 }, auth);
      logs = r.logs ?? [];
      // Persist so log history survives bot/gateway restarts.
      persistLogs(logs);
    } catch (e) {
      console.error('[logs] logs.list failed:', e);
      if (isTransientRpcError(e)) {
        logs = readPersistedLogs({ limit: 300 });
        cached = true;
      }
    }
  } else if (isOwner && !online) {
    logs = readPersistedLogs({ limit: 300 });
    cached = true;
  }
  return { isOwner, logs, cached, online };
};
