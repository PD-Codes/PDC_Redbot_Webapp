import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

// Renders a cog-registered page. `key` = "<CogName>:<identifier>". An optional
// ?guild=<id> scopes the call to a guild (for guild-scoped pages).
export const load: PageServerLoad = async ({ locals, params, url, cookies }) => {
  if (!locals.user) throw redirect(302, '/login');
  const key = params.key;
  const guildId = url.searchParams.get('guild');
  const uiLocale = cookies.get('locale');
  const auth = authFromUser(locals.user, guildId, uiLocale);
  try {
    const [manifest, page] = await Promise.all([
      rpc<{ contributions: Array<Record<string, unknown>> }>('manifest.get', {}, auth),
      rpc<{ schema: unknown }>('page.schema', { key }, auth)
    ]);
    const meta = (manifest.contributions ?? []).find((c) => c.key === key && c.kind === 'page');
    if (!meta) throw error(404, 'Seite nicht gefunden.');
    return { key, guildId, name: meta.name as string, icon: (meta.icon as string) ?? null, schema: page.schema };
  } catch (e) {
    if (e instanceof RpcError) throw error(502, e.message);
    throw e;
  }
};
