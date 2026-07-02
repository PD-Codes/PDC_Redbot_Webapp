import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError, isTransientRpcError } from '$lib/server/rpc';
import { persistLogs, readPersistedLogs, type StoredLogEntry } from '$lib/server/logStore';
import { rememberOwner, wasRecentlyOwner } from '$lib/server/ownerCache';

const METHODS: Record<string, string> = {
  settings_get: 'dashboard.settings_get',
  settings_set: 'dashboard.settings_set',
  overview: 'dashboard.overview',
  lock: 'dashboard.lock',
  refresh_sessions: 'dashboard.refresh_sessions',
  pages_save: 'pages.save',
  pages_delete: 'pages.delete',
  pages_get: 'pages.get',
  audit_list: 'audit.list',
  system_info: 'system.info',
  logs_list: 'logs.list'
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json();
  const method = METHODS[body.action];
  if (!method) return json({ error: 'unknown action' }, { status: 400 });
  const { action, ...args } = body;
  try {
    const result = await rpc<Record<string, unknown>>(method, args, authFromUser(locals.user));
    // Persist fetched bot logs so they survive bot/gateway restarts. The gateway
    // enforces owner-only access for logs.list, so a success also verifies ownership.
    if (action === 'logs_list' && Array.isArray(result?.logs)) {
      rememberOwner(locals.user.id, true);
      persistLogs(result.logs as StoredLogEntry[]);
    }
    if (action === 'overview' && typeof result?.is_owner === 'boolean') {
      rememberOwner(locals.user.id, result.is_owner as boolean);
    }
    return json(result);
  } catch (e) {
    // Graceful degradation: if the gateway is down, serve persisted logs instead
    // of a hard error (marked as cached so the UI can say so). Only for users
    // that were positively verified as bot owner while the gateway was up.
    if (action === 'logs_list' && isTransientRpcError(e) && wasRecentlyOwner(locals.user.id)) {
      const cachedLogs = readPersistedLogs({
        level: typeof args.level === 'string' ? args.level : '',
        query: typeof args.query === 'string' ? args.query : '',
        limit: typeof args.limit === 'number' ? args.limit : 500
      });
      return json({ logs: cachedLogs, cached: true });
    }
    console.error(`[api/dashboard] action "${action}" failed:`, e);
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};
