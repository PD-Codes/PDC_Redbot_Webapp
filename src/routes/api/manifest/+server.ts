import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const guildId = url.searchParams.get('guild');
  try {
    const res = await rpc<{ contributions: unknown[] }>(
      'manifest.get',
      {},
      authFromUser(locals.user, guildId)
    );
    return json(res);
  } catch (e) {
    const msg = e instanceof RpcError ? e.message : 'Gateway nicht erreichbar';
    return json({ error: msg }, { status: 502 });
  }
};
