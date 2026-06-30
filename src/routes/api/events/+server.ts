import type { RequestHandler } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

// Server-Sent-Events stream. The browser keeps one connection open; we poll the
// gateway server-side (token stays on the server) and push the overview ONLY when
// it changed. This gives the UI live counters/online-status without the browser
// polling the API itself.
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return new Response('unauthorized', { status: 401 });
  const auth = authFromUser(locals.user);
  const enc = new TextEncoder();

  let poll: ReturnType<typeof setInterval> | undefined;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let lastJson = '';
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const tick = async () => {
        try {
          const ov = await rpc<Record<string, unknown>>('dashboard.overview', {}, auth, 8000);
          const j = JSON.stringify(ov);
          if (j !== lastJson) {
            lastJson = j;
            send('overview', ov);
          }
        } catch {
          send('gateway_error', { ok: false });
        }
      };

      send('hello', { ok: true });
      await tick();
      poll = setInterval(tick, 5000);
      // Keep-alive comment so reverse proxies don't drop the idle connection.
      keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`: keep-alive\n\n`));
        } catch {
          closed = true;
        }
      }, 20000);
    },
    cancel() {
      if (poll) clearInterval(poll);
      if (keepAlive) clearInterval(keepAlive);
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
