import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  const auth = authFromUser(locals.user);
  try {
    const [globalSettings, dash, overview, manifest] = await Promise.all([
      rpc('settings.get', { scope: 'global' }, auth),
      rpc('dashboard.settings_get', {}, auth),
      rpc('dashboard.overview', {}, auth),
      rpc<{ contributions: any[] }>('manifest.get', {}, auth) // ohne Guild = globaler Kontext
    ]);
    const globalPanels = (manifest.contributions ?? []).filter(
      (c) => c.kind === 'panel' && c.scope === 'global'
    );
    return { globalSettings, dash, overview, globalPanels, forbidden: false, online: true };
  } catch (e) {
    if (e instanceof RpcError && e.code === -32001)
      return { globalSettings: null, dash: null, overview: null, globalPanels: [], forbidden: true, online: true };
    return { globalSettings: null, dash: null, overview: null, globalPanels: [], forbidden: false, online: false };
  }
};
