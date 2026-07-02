import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { filterRecentlyUpdated } from '$lib/server/updatedCogs';

// Monitor config + last cog-update result (bot owner only, enforced by the gateway).
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  try {
    const r = await rpc<{ config?: unknown; last?: { cogs?: string[]; checked_at?: number } }>(
      'monitor.get',
      {},
      authFromUser(locals.user)
    );
    // The bot's "last check" list is stale right after a cog was updated via the
    // dashboard – drop cogs we updated since then so the badge count is correct.
    if (r?.last && Array.isArray(r.last.cogs)) {
      r.last.cogs = filterRecentlyUpdated(r.last.cogs, Number(r.last.checked_at ?? 0));
    }
    return json(r);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json();
  try {
    return json(await rpc('monitor.set', body, authFromUser(locals.user)));
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};
