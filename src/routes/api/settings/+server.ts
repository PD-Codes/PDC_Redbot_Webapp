import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const scope = url.searchParams.get('scope') ?? 'guild';
  const guild = url.searchParams.get('guild');
  try {
    const r = await rpc('settings.get', { scope }, authFromUser(locals.user, guild));
    return json(r);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { scope, guild, field, value } = await request.json();
  try {
    const r = await rpc('settings.set', { scope, field, value }, authFromUser(locals.user, guild));
    return json(r);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
