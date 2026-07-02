import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, rpcWithRetry, authFromUser, RpcError, isTransientRpcError } from '$lib/server/rpc';

export interface FeatureContribution {
  key: string;
  kind: string;
  name: string;
  cog: string;
  description?: string | null;
  icon?: string | null;
  scope?: string | null;
  order?: number;
}

export interface FeatureGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface FeatureCogState {
  name: string;
  loaded: boolean;
  has_dashboard: boolean;
}

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  if (!locals.user) throw redirect(302, '/login');
  const uiLocale = cookies.get('locale');

  const out: {
    online: boolean;
    isOwner: boolean;
    guilds: FeatureGuild[];
    guildId: string | null;
    cogs: FeatureCogState[];
    contributions: FeatureContribution[];
  } = { online: true, isOwner: false, guilds: [], guildId: null, cogs: [], contributions: [] };

  // Guilds the user can manage/see – used as the target for per-guild setup.
  try {
    const g = await rpcWithRetry<{ guilds: FeatureGuild[] }>('core.guilds', {}, authFromUser(locals.user));
    out.guilds = g.guilds ?? [];
  } catch (e) {
    if (isTransientRpcError(e)) {
      out.online = false;
      return out;
    }
    // Non-transient: continue without guilds (setup buttons degrade gracefully).
  }

  const q = url.searchParams.get('guild');
  out.guildId = q && out.guilds.some((g) => g.id === q) ? q : (out.guilds[0]?.id ?? null);

  // Manifest in guild context so guild-scoped panels/pages are visible too.
  try {
    const m = await rpc<{ contributions: FeatureContribution[] }>(
      'manifest.get',
      {},
      authFromUser(locals.user, out.guildId, uiLocale)
    );
    out.contributions = m.contributions ?? [];
  } catch {
    out.online = false;
    return out;
  }

  // Owner-only: full cog list with loaded state (enables the load/unload toggle).
  // Non-owners get -32001 here – simply hide the controls in that case.
  try {
    const c = await rpc<{ cogs: FeatureCogState[] }>('cogs.list', {}, authFromUser(locals.user));
    out.cogs = c.cogs ?? [];
    out.isOwner = true;
  } catch (e) {
    if (e instanceof RpcError && e.code === -32001) out.isOwner = false;
    // Any other error: also degrade to "no toggles" instead of failing the page.
  }

  return out;
};
