import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';
import { normalizeCogName, catalogFor } from '$lib/features/catalog';

export interface SetupPanel {
  key: string;
  kind: string;
  name: string;
  cog: string;
  description?: string | null;
  scope?: string | null;
  order?: number;
}

/**
 * Setup wizard for one module: collects the module's existing settings panels
 * (registered via the dashboard integration) and presents them step by step.
 * Rendering itself reuses the shared PanelForm component – no duplicated logic.
 */
export const load: PageServerLoad = async ({ locals, params, url, cookies }) => {
  if (!locals.user) throw redirect(302, '/login');
  const guildId = url.searchParams.get('guild');
  const auth = authFromUser(locals.user, guildId, cookies.get('locale'));

  const target = normalizeCogName(params.cog);
  const meta = catalogFor(params.cog);

  let panels: SetupPanel[] = [];
  let online = true;
  try {
    const m = await rpc<{ contributions: SetupPanel[] }>('manifest.get', {}, auth);
    panels = (m.contributions ?? [])
      .filter(
        (c) =>
          c.kind === 'panel' &&
          normalizeCogName(c.cog) === target &&
          // With a guild selected show guild-scoped panels, otherwise global ones.
          (guildId ? c.scope !== 'global' : c.scope === 'global')
      )
      .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.name.localeCompare(b.name));
  } catch {
    online = false;
  }

  return { cog: params.cog, emoji: meta?.emoji ?? '🧩', catalogKey: meta?.key ?? null, guildId, panels, online };
};
