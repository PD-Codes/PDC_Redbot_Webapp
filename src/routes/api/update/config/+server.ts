import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { getIntervalH, setIntervalH, getLastResult, ALLOWED_INTERVALS } from '$lib/server/updateCheck';

async function requireOwner(locals: App.Locals): Promise<string | null> {
  if (!locals.user) return 'unauthorized';
  try {
    const ov = await rpc<{ is_owner: boolean }>('dashboard.overview', {}, authFromUser(locals.user));
    if (!ov.is_owner) return 'forbidden';
  } catch (e) {
    return e instanceof RpcError ? e.message : 'Gateway-Fehler';
  }
  return null;
}

// Read the automatic update-check settings + last cached result.
export const GET: RequestHandler = async ({ locals }) => {
  const err = await requireOwner(locals);
  if (err) return json({ error: err }, { status: err === 'unauthorized' ? 401 : 403 });
  return json({ intervalH: getIntervalH(), allowed: ALLOWED_INTERVALS, last: getLastResult() });
};

// Set the automatic check interval (hours). 0 = off. Reschedules immediately.
export const POST: RequestHandler = async ({ locals, request }) => {
  const err = await requireOwner(locals);
  if (err) return json({ error: err }, { status: err === 'unauthorized' ? 401 : 403 });
  const { intervalH } = await request.json();
  const n = setIntervalH(Number(intervalH));
  return json({ ok: true, intervalH: n });
};
