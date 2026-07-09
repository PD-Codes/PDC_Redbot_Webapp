import type { RequestHandler } from './$types';
import { rpc, authFromUser, type RpcAuth } from '$lib/server/rpc';

// Server-Sent-Events stream. The browser keeps one connection open; we poll the
// gateway server-side (token stays on the server) and push the overview ONLY when
// it changed. This gives the UI live counters/online-status without the browser
// polling the API itself.
//
// Polling is SHARED at module scope: one poll loop per user (dashboard.overview
// is user-specific, e.g. is_owner), no matter how many tabs/connections that
// user has open. The loop only runs while at least one subscriber exists and is
// stopped as soon as the last one disconnects.

type Subscriber = (event: string, data: unknown) => void;

interface PollGroup {
  subscribers: Set<Subscriber>;
  timer: ReturnType<typeof setInterval>;
  lastJson: string;
  lastData: unknown; // last overview, replayed to late joiners
}

const groups = new Map<string, PollGroup>();

async function pollOnce(userId: string, auth: RpcAuth): Promise<void> {
  let group = groups.get(userId);
  if (!group) return; // last subscriber left before this tick ran
  try {
    const ov = await rpc<Record<string, unknown>>('dashboard.overview', {}, auth, 8000);
    group = groups.get(userId);
    if (!group) return; // group was torn down while the RPC was in flight
    const j = JSON.stringify(ov);
    if (j !== group.lastJson) {
      group.lastJson = j;
      group.lastData = ov;
      for (const sub of [...group.subscribers]) sub('overview', ov);
    }
  } catch {
    group = groups.get(userId);
    if (!group) return;
    for (const sub of [...group.subscribers]) sub('gateway_error', { ok: false });
  }
}

/** Register a subscriber; returns the unsubscribe fn and the cached overview (if any). */
function subscribe(
  userId: string,
  auth: RpcAuth,
  cb: Subscriber
): { unsubscribe: () => void; cached: unknown } {
  let group = groups.get(userId);
  if (!group) {
    group = {
      subscribers: new Set(),
      lastJson: '',
      lastData: undefined,
      timer: setInterval(() => void pollOnce(userId, auth), 5000)
    };
    groups.set(userId, group);
  }
  group.subscribers.add(cb);
  const unsubscribe = () => {
    const g = groups.get(userId);
    if (!g) return;
    g.subscribers.delete(cb);
    if (g.subscribers.size === 0) {
      clearInterval(g.timer);
      groups.delete(userId);
    }
  };
  return { unsubscribe, cached: group.lastData };
}

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return new Response('unauthorized', { status: 401 });
  const userId = locals.user.id;
  const auth = authFromUser(locals.user);
  const enc = new TextEncoder();

  let closed = false;
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  // Stop EVERYTHING for this connection (idempotent; also safe pre-subscribe).
  const close = () => {
    closed = true;
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = undefined;
    unsubscribe?.();
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Connection is gone → release the shared poller + keep-alive at once.
          close();
        }
      };

      send('hello', { ok: true });
      if (closed) return;

      const sub = subscribe(userId, auth, send);
      unsubscribe = sub.unsubscribe;

      // Deliver the current state immediately: replay the shared poller's cache,
      // or run the first poll now for a fresh group.
      if (sub.cached !== undefined) send('overview', sub.cached);
      else await pollOnce(userId, auth);
      if (closed) return;

      // Keep-alive comment so reverse proxies don't drop the idle connection.
      keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`: keep-alive\n\n`));
        } catch {
          close();
        }
      }, 20000);
    },
    cancel() {
      close();
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive'
    }
  });
};
