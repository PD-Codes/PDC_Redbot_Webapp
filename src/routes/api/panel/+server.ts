import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { op, key, guildId, data, locale } = await request.json();
  const auth = authFromUser(locals.user, guildId, locale);
  try {
    if (op === 'schema') {
      return json(await rpc('panel.schema', { key }, auth));
    }
    if (op === 'submit') {
      return json(await rpc('panel.submit', { key, data }, auth));
    }
    return json({ error: 'unbekannte Operation' }, { status: 400 });
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
