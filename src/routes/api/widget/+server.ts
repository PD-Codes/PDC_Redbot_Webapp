import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { key, guildId, locale } = await request.json();
  try {
    const res = await rpc<{ data: unknown }>(
      'widget.data',
      { key },
      authFromUser(locals.user, guildId, locale)
    );
    return json(res);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
