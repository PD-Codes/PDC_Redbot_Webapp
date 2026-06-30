import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
  if (!locals.user) throw redirect(302, '/login');
  const uiLocale = cookies.get('locale'); // gewählte Webseiten-Sprache (de-DE/en-US)
  try {
    const detail = await rpc('core.guild_detail', {}, authFromUser(locals.user, params.id, uiLocale));
    // Manifest (Widgets/Panels) für diese Guild – für eingebettete Cog-Inhalte;
    // Modul-Namen/Beschreibungen werden in der UI-Sprache geliefert.
    const manifest = await rpc<{ contributions: unknown[] }>(
      'manifest.get',
      {},
      authFromUser(locals.user, params.id, uiLocale)
    );
    return { detail, contributions: manifest.contributions ?? [], guildId: params.id };
  } catch (e) {
    if (e instanceof RpcError && e.code === -32001) throw error(403, 'Kein Zugriff auf diesen Server.');
    throw error(502, 'Server-Details konnten nicht geladen werden.');
  }
};
