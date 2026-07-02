import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

const METHODS: Record<string, string> = {
  sync: 'slash.sync',
  set: 'slash.set',
  set_cog: 'slash.set_cog'
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const method = METHODS[body.action ?? 'sync'];
  if (!method) return json({ error: 'unknown action' }, { status: 400 });
  const { action, ...args } = body;
  try {
    // Slash sync hits Discord rate limits; give it more headroom than the default.
    return json(await rpc(method, args, authFromUser(locals.user), 60_000));
  } catch (e) {
    console.error(`[api/slash] action "${action ?? 'sync'}" failed:`, e);
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};
