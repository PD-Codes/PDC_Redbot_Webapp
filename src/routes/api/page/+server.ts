import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

// Fetch a cog page's schema. `params` carries the current control values
// (e.g. { region: "eu", type: "retail" }) so the cog handler returns matching data.
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const { key, params, guildId, locale } = await request.json();
  if (!key) return json({ error: 'missing key' }, { status: 400 });
  try {
    const res = await rpc<{ schema: unknown }>(
      'page.schema',
      { key, ...(params ?? {}) },
      authFromUser(locals.user, guildId ?? null, locale)
    );
    return json(res);
  } catch (e) {
    return json({ error: e instanceof RpcError ? e.message : 'Fehler' }, { status: 502 });
  }
};
