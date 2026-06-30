import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

// Owner-Aktion: Cog laden/entladen/neu laden.
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { name, action } = await request.json();
  try {
    const r = await rpc('cogs.set', { name, action }, authFromUser(locals.user));
    return json(r);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
