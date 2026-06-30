import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, RpcError } from '$lib/server/rpc';

// Öffentlich: KEIN Login nötig. Der Token bleibt serverseitig (BFF).
export const GET: RequestHandler = async () => {
  try {
    const res = await rpc('core.commands', {});
    return json(res);
  } catch (e) {
    const msg = e instanceof RpcError ? e.message : 'Gateway nicht erreichbar';
    return json({ error: msg }, { status: 502 });
  }
};
