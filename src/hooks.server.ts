import type { Handle, HandleServerError } from '@sveltejs/kit';
import { readSession, clearSession } from '$lib/server/session';
import { rpc } from '$lib/server/rpc';

// Session-Epoch ("Sessions zurücksetzen") – zwischengespeichert, um nicht bei
// jedem Request das Gateway zu fragen.
let cachedEpoch = 0;
let cachedAt = 0;
const TTL = 60_000;

async function getEpoch(): Promise<number> {
  const now = Date.now();
  if (now - cachedAt < TTL) return cachedEpoch;
  try {
    const r = await rpc<{ epoch: number }>('dashboard.session_epoch', {});
    cachedEpoch = (r.epoch ?? 0) * 1000; // Sekunden -> ms
    cachedAt = now;
  } catch {
    // Fail-open: bei Gateway-Problemen keine Invalidierung erzwingen.
  }
  return cachedEpoch;
}

export const handle: Handle = async ({ event, resolve }) => {
  const user = readSession(event.cookies);
  if (user) {
    const epoch = await getEpoch();
    if (epoch && (user.iat ?? 0) < epoch) {
      // Session vor dem letzten Reset ausgestellt -> abmelden.
      clearSession(event.cookies);
      event.locals.user = null;
    } else {
      event.locals.user = user;
    }
  } else {
    event.locals.user = null;
  }

  try {
    return await resolve(event);
  } catch (err) {
    // Externe Bots/Scanner klopfen ständig nicht-existente Pfade ab
    // (z. B. /robots.txt, /assets/js/*.js, /bot-connect.js, *.php). Diese 404s
    // ruhig beantworten, statt den Journal-Log mit Stacktraces zu fluten.
    const status = (err as { status?: number } | null)?.status;
    if (status === 404) {
      return new Response('Not found', {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' }
      });
    }
    throw err;
  }
};

// SvelteKit ruft dies bei unerwarteten Fehlern auf. 404s (Bot-Probes) NICHT loggen,
// alles andere mit voller Info ins Journal.
export const handleError: HandleServerError = ({ error, status }) => {
  if (status !== 404) {
    console.error(error);
  }
  return { message: status === 404 ? 'Not found' : 'Internal Error' };
};
