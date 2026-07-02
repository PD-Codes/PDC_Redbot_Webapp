import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { dedupe } from '$lib/server/inflight';
import { recordCogUpdated } from '$lib/server/updatedCogs';

const METHODS: Record<string, string> = {
  repo_add: 'downloader.repo_add',
  repo_remove: 'downloader.repo_remove',
  update_check: 'downloader.update_check',
  cog_install: 'downloader.cog_install',
  cog_uninstall: 'downloader.cog_uninstall',
  cog_update: 'downloader.cog_update',
  repos: 'downloader.repos'
};

// Downloader operations (git clone/pull, pip installs, post-install reload of
// slow cogs) can take several minutes; 5 min ceiling as a safety net only.
const DOWNLOADER_TIMEOUT_MS = 300_000;

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const user = locals.user; // narrow for use inside the closure below
  const body = await request.json();
  const method = METHODS[body.action];
  if (!method) return json({ error: 'unknown action' }, { status: 400 });
  const { action, ...args } = body;
  try {
    // Idempotency guard: identical in-flight requests (rapid double clicks)
    // share one RPC. The gateway additionally serializes downloader operations
    // with its own lock.
    const key = `downloader:${user.id}:${action}:${JSON.stringify(args)}`;
    const r = await dedupe(key, () => rpc(method, args, authFromUser(user), DOWNLOADER_TIMEOUT_MS));
    // Keep the sidebar "cog updates" badge in sync: this cog is up to date now.
    if (action === 'cog_update' && typeof args.cog === 'string') {
      recordCogUpdated(args.cog);
    }
    return json(r);
  } catch (e) {
    console.error(`[api/downloader] action "${action}" failed:`, e);
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};
