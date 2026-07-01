import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

// Monitor config + last cog-update result (bot owner only, enforced by the gateway).
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  try {
    return json(await rpc('monitor.get', {}, authFromUser(locals.user)));
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json();
  try {
    return json(await rpc('monitor.set', body, authFromUser(locals.user)));
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
