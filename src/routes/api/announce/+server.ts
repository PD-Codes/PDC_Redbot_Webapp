import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

const METHODS: Record<string, string> = {
  channels: 'announce.channels',
  send: 'announce.send'
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { op, guildId, ...rest } = await request.json();
  const method = METHODS[op];
  if (!method) return json({ error: 'unbekannte Operation' }, { status: 400 });
  if (!guildId) return json({ error: 'guildId fehlt' }, { status: 400 });
  const auth = authFromUser(locals.user, guildId);
  try {
    return json(await rpc(method, rest, auth));
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
