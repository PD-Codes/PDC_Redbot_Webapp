import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { rpc, authFromUser } from '$lib/server/rpc';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  // Nur Bot-Owner dürfen die Entwickler-/Integrationsdoku sehen.
  try {
    const info = await rpc<{ is_owner: boolean }>('core.botinfo', {}, authFromUser(locals.user));
    if (!info.is_owner) throw error(403, 'Nur für Bot-Owner.');
  } catch (e) {
    if (e instanceof Response) throw e;
    throw error(502, 'Gateway nicht erreichbar.');
  }
  return {};
};
