import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/env';

/** Lightweight gateway liveness proxy. Used by the client for:
 *  - the "gateway restarting" countdown (poll until the gateway is back)
 *  - the global offline banner (graceful degradation when the bot is down)
 * The gateway exposes GET /api/health without auth; we still keep this
 * behind the webapp so the gateway address/token never reach the client. */
export const GET: RequestHandler = async () => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 3000);
  try {
    const res = await fetch(`${config.gatewayUrl}/api/health`, { signal: ac.signal });
    return json({ ok: res.ok });
  } catch {
    return json({ ok: false });
  } finally {
    clearTimeout(timer);
  }
};
