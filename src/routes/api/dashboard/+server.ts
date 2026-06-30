import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

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
  if (!method) return json({ error: 'unbekannte Aktion' }, { status: 400 });
  const { action, ...args } = body;
  try {
    return json(await rpc(method, args, authFromUser(locals.user)));
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
