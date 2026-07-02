import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';
import { dedupe } from '$lib/server/inflight';

// Cogs required by the web dashboard. Unloading the gateway cog would kill the
// very RPC connection this app depends on, so it is blocked server-side too
// (the UI already disables the toggle, but the API must not trust the client).
const PROTECTED_COGS = new Set(['pdc_webdashboard', 'pdc_webdashboard_stats']);
const GATEWAY_COG = 'pdc_webdashboard';

// Cog load/reload can take a while (imports, slash registration) — some cogs
// need up to 2 minutes. Effectively no early cutoff: 5 min hard ceiling only
// as a last-resort safety net against a fully hung gateway.
const COG_ACTION_TIMEOUT_MS = 300_000;

interface BulkResult {
  name: string;
  ok: boolean;
  error?: string;
}

/** Owner action: load/unload/reload a single cog, or bulk-load many. */
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) return json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const { name, action, names } = body as { name?: string; action?: string; names?: string[] };
  const auth = authFromUser(locals.user);

  // Bulk activation: load all given cogs sequentially server-side (one RPC per
  // cog) and report a per-cog result. Sequential on purpose – parallel loads
  // would fight over the bot's event loop and Red's package config.
  if (action === 'load_all') {
    const targets = (Array.isArray(names) ? names : [])
      .map((n) => String(n ?? '').trim())
      .filter(Boolean);
    if (!targets.length) return json({ error: 'names required' }, { status: 400 });
    // Idempotency: a second identical request while the first is still running
    // (double click, second tab) attaches to the in-flight run instead of
    // loading everything twice.
    const key = `cogs:load_all:${targets.slice().sort().join(',')}`;
    const results = await dedupe<BulkResult[]>(key, async () => {
      const out: BulkResult[] = [];
      for (const cog of targets) {
        try {
          await rpc('cogs.set', { name: cog, action: 'load' }, auth, COG_ACTION_TIMEOUT_MS);
          // Reload so the freshly loaded cog's (slash) commands and dashboard
          // contributions register immediately. Never reload the gateway cog
          // itself here – that would restart the gateway mid-run.
          if (cog.toLowerCase() !== GATEWAY_COG) {
            try {
              await rpc('cogs.set', { name: cog, action: 'reload' }, auth, COG_ACTION_TIMEOUT_MS);
            } catch (e) {
              console.error(`[api/cogs] post-load reload of "${cog}" failed:`, e);
            }
          }
          out.push({ name: cog, ok: true });
        } catch (e) {
          const msg = e instanceof RpcError ? e.message : 'Error';
          console.error(`[api/cogs] bulk load of "${cog}" failed:`, e);
          out.push({ name: cog, ok: false, error: msg });
        }
      }
      return out;
    });
    const failed = results.filter((r) => !r.ok);
    return json({ ok: failed.length === 0, results, loaded: results.length - failed.length, failed: failed.length });
  }

  if (!name || !action) return json({ error: 'name/action required' }, { status: 400 });

  // Guard rail: never allow unloading the dashboard gateway cog through the API.
  if (action === 'unload' && PROTECTED_COGS.has(String(name).toLowerCase())) {
    return json(
      { error: `Cog "${name}" is required by the web dashboard and cannot be unloaded from here.` },
      { status: 400 }
    );
  }

  try {
    // Dedup rapid double-clicks: identical (user, cog, action) requests share
    // one in-flight RPC instead of firing twice.
    const key = `cogs:${locals.user.id}:${action}:${String(name).toLowerCase()}`;
    const r = await dedupe(key, () =>
      rpc('cogs.set', { name, action }, auth, COG_ACTION_TIMEOUT_MS)
    );
    return json(r);
  } catch (e) {
    console.error(`[api/cogs] ${action} "${name}" failed:`, e);
    return json({ error: e instanceof RpcError ? e.message : 'Error' }, { status: 502 });
  }
};
