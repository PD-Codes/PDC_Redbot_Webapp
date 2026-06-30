import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

const METHODS: Record<string, string> = {
  repo_add: 'downloader.repo_add',
  repo_remove: 'downloader.repo_remove',
  update_check: 'downloader.update_check',
  cog_install: 'downloader.cog_install',
  cog_uninstall: 'downloader.cog_uninstall',
  cog_update: 'downloader.cog_update',
  repos: 'downloader.repos'
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json();
  const method = METHODS[body.action];
  if (!method) return json({ error: 'unbekannte Aktion' }, { status: 400 });
  const { action, ...args } = body;
  try {
    const r = await rpc(method, args, authFromUser(locals.user));
    return json(r);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
