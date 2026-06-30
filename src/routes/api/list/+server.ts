import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { op, key, guildId, id, data } = await request.json();
  const auth = authFromUser(locals.user, guildId);
  try {
    if (op === 'rows') return json(await rpc('list.rows', { key }, auth));
    if (op === 'delete') return json(await rpc('list.delete', { key, id }, auth));
    if (op === 'edit_form') return json(await rpc('list.edit_form', { key, id }, auth));
    if (op === 'edit') return json(await rpc('list.edit', { key, id, data }, auth));
    return json({ error: 'unbekannte Operation' }, { status: 400 });
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
