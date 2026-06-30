import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser, RpcError } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) throw redirect(302, '/login');
  try {
    const settings = await rpc('settings.get', { scope: 'guild' }, authFromUser(locals.user, params.id));
    return { settings, guildId: params.id };
  } catch (e) {
    if (e instanceof RpcError && e.code === -32001) throw error(403, 'Nur Server-Admins.');
    throw error(502, 'Einstellungen konnten nicht geladen werden.');
  }
};
